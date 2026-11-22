/* ===========================================================
   Testes de coerência: motor (js/pda.js) × JFLAP (jflap/*.jff)

   Garantem que o código do site e o arquivo do JFLAP descrevem
   exatamente o mesmo autômato:
     1. lê o .jff e compara estados, rótulos, inicial, finais e
        as 17 transições com o motor;
     2. repete os roteiros testados no JFLAP 7.1 (Multiple Run,
        aceitação por estado final) e confere o mesmo resultado;
     3. compara o motor com um simulador de referência montado
        SÓ a partir do .jff, em todas as palavras possíveis até
        um certo tamanho.

   Como rodar (Node 18 ou superior), na pasta do repositório:
     node --test
   =========================================================== */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PDA = require('../js/pda.js');

const ARQUIVO_JFF = path.join(__dirname, '..', 'jflap', 'masmorra-chave-partida.jff');

/* ---------------------------------------------------------
   Leitura do .jff (XML do JFLAP), sem bibliotecas externas
   --------------------------------------------------------- */

function lerJff(arquivo) {
  const xml = fs.readFileSync(arquivo, 'utf8');
  const tipo = (xml.match(/<type>(.*?)<\/type>/) || [])[1];

  // Conteúdo de uma tag; tag vazia (<pop/>) ou ausente = λ
  const campo = (bloco, tag) => {
    const m = bloco.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
    return m ? m[1] : '';
  };

  const estados = [...xml.matchAll(/<state id="(\d+)" name="([^"]*)">([\s\S]*?)<\/state>/g)].map((m) => ({
    id: m[1],
    nome: m[2],
    rotulo: campo(m[3], 'label'),
    inicial: /<initial\s*\/>/.test(m[3]),
    final: /<final\s*\/>/.test(m[3])
  }));

  const nomePorId = Object.fromEntries(estados.map((e) => [e.id, e.nome]));

  const transicoes = [...xml.matchAll(/<transition>([\s\S]*?)<\/transition>/g)].map((m) => ({
    de: nomePorId[campo(m[1], 'from')],
    para: nomePorId[campo(m[1], 'to')],
    le: campo(m[1], 'read'),
    desempilha: campo(m[1], 'pop'),
    empilha: campo(m[1], 'push')
  }));

  return { tipo, estados, transicoes };
}

const JFF = lerJff(ARQUIVO_JFF);

const chave = (t) => `${t.de} → ${t.para} : ${t.le}, ${t.desempilha || 'λ'} ; ${t.empilha || 'λ'}`;

/* ---------------------------------------------------------
   Simulador de referência, construído apenas com o .jff.
   Segue a semântica do JFLAP para PDA: não determinístico,
   trabalha com um CONJUNTO de configurações e aceita por estado
   final quando toda a entrada foi consumida. Não usa nada do motor.
   --------------------------------------------------------- */

const REF = (() => {
  const inicial = JFF.estados.find((e) => e.inicial).nome;
  const finais = new Set(JFF.estados.filter((e) => e.final).map((e) => e.nome));

  // Aplica as transições que leem λ até não surgir configuração nova (fecho-λ)
  function fecho(conjunto) {
    const resultado = new Set(conjunto);
    const pendentes = [...conjunto];
    while (pendentes.length) {
      const [q, pilha] = pendentes.pop().split('|');
      for (const t of JFF.transicoes) {
        if (t.de === q && t.le === '' && pilha.startsWith(t.desempilha)) {
          const nova = t.para + '|' + t.empilha + pilha.slice(t.desempilha.length);
          if (!resultado.has(nova)) {
            if (resultado.size > 10000) throw new Error('fecho-λ não termina');
            resultado.add(nova);
            pendentes.push(nova);
          }
        }
      }
    }
    return resultado;
  }

  function comecar() { return fecho(new Set([inicial + '|Z'])); }

  function ler(conjunto, simbolo) {
    const proximo = new Set();
    for (const c of conjunto) {
      const [q, pilha] = c.split('|');
      for (const t of JFF.transicoes) {
        if (t.de === q && t.le === simbolo && pilha.startsWith(t.desempilha)) {
          proximo.add(t.para + '|' + t.empilha + pilha.slice(t.desempilha.length));
        }
      }
    }
    return fecho(proximo);
  }

  function aceita(conjunto) {
    return [...conjunto].some((c) => finais.has(c.split('|')[0]));
  }

  function executar(palavra) {
    let conjunto = comecar();
    for (const x of palavra) conjunto = ler(conjunto, x);
    return aceita(conjunto);
  }

  return { comecar, ler, aceita, executar };
})();

/* ---------------------------------------------------------
   1. Estrutura: .jff × motor
   --------------------------------------------------------- */

describe('Estrutura do .jff igual à do motor', () => {
  it('o arquivo é um autômato de pilha (tipo "pda")', () => {
    assert.equal(JFF.tipo, 'pda');
  });

  it('mesmos estados, na mesma ordem, com o nome da sala como rótulo', () => {
    assert.deepEqual(
      JFF.estados.map((e) => [e.nome, e.rotulo]),
      PDA.ESTADOS.map((e) => [e.id, e.sala])
    );
  });

  it('mesmo estado inicial', () => {
    assert.deepEqual(JFF.estados.filter((e) => e.inicial).map((e) => e.nome), [PDA.ESTADO_INICIAL]);
  });

  it('mesmos estados finais', () => {
    assert.deepEqual(JFF.estados.filter((e) => e.final).map((e) => e.nome), [...PDA.ESTADOS_FINAIS]);
  });

  it('mesmas 17 transições (de, para, lê, desempilha, empilha)', () => {
    assert.equal(JFF.transicoes.length, 17);
    assert.deepEqual(
      JFF.transicoes.map(chave).sort(),
      PDA.TRANSICOES.map(chave).sort()
    );
  });

  it('mesmas transições na mesma ordem da numeração do escopo', () => {
    assert.deepEqual(JFF.transicoes.map(chave), PDA.TRANSICOES.map(chave));
  });

  it('o Σ usado no .jff é o Σ do motor', () => {
    const sigmaJff = new Set(JFF.transicoes.map((t) => t.le).filter(Boolean));
    assert.deepEqual([...sigmaJff].sort(), [...PDA.ALFABETO].sort());
  });

  it('o Γ usado no .jff (mais o Z inicial do JFLAP) é o Γ do motor', () => {
    const gamaJff = new Set(['Z']);
    for (const t of JFF.transicoes) for (const g of t.desempilha + t.empilha) gamaJff.add(g);
    assert.deepEqual([...gamaJff].sort(), [...PDA.ALFABETO_PILHA].sort());
  });
});

/* ---------------------------------------------------------
   2. Resultados obtidos rodando o .jff no JFLAP 7.1
      (Input → Multiple Run, aceitação por estado final)
   --------------------------------------------------------- */

const RESULTADOS_JFLAP = [
  ['*saasasbc',  'ACEITA'],
  ['*casaasbc',  'ACEITA'],
  ['*sasasbc',   'REJEITADA'],
  ['*caasaasbc', 'REJEITADA'],
  ['*saasaa',    'REJEITADA'],
  ['saas',       'REJEITADA'],
  ['caas',       'REJEITADA'],
  ['**',         'REJEITADA'],
  ['*sc',        'REJEITADA'],
  ['*sx',        'REJEITADA'],
  ['*saasasb',   'REJEITADA'],
  ['',           'REJEITADA'],
  ['*caasasbc',  'ACEITA'],
  ['*sasaasbc',  'ACEITA'],
  ['*saassbc',   'REJEITADA']
];

describe('Mesmos resultados do JFLAP 7.1', () => {
  for (const [palavra, esperado] of RESULTADOS_JFLAP) {
    it(`"${palavra}" → ${esperado}`, () => {
      assert.equal(PDA.executar(palavra).aceita ? 'ACEITA' : 'REJEITADA', esperado, 'motor');
      assert.equal(REF.executar(palavra) ? 'ACEITA' : 'REJEITADA', esperado, 'simulador de referência');
    });
  }

  it('os 4 exemplos da interface estão entre os testados no JFLAP', () => {
    const testadas = new Map(RESULTADOS_JFLAP);
    for (const ex of PDA.EXEMPLOS) assert.equal(testadas.get(ex.roteiro), ex.esperado);
  });
});

/* ---------------------------------------------------------
   3. Equivalência exaustiva: motor × simulador do .jff
   Percorre todas as palavras sobre Σ ∪ {x, A} (x e A fora do
   alfabeto) até TAMANHO_MAXIMO. Em cada prefixo, a configuração
   do motor tem de ser a ÚNICA configuração do simulador de
   referência. Quando os dois "morrem" no mesmo prefixo (nenhuma
   transição), qualquer continuação é rejeitada pelos dois, então
   esse ramo inteiro fica verificado sem precisar ser expandido.
   --------------------------------------------------------- */

const TAMANHO_MAXIMO = 14;
const SIMBOLOS_TESTE = [...PDA.ALFABETO, 'x', 'A'];

describe(`Equivalência com o .jff em todas as palavras de até ${TAMANHO_MAXIMO} símbolos`, () => {
  it('motor e simulador de referência concordam em todo prefixo', () => {
    let prefixosVivos = 0, ramosMortos = 0;
    const aceitas = [];

    function explorar(palavra, config, conjunto) {
      prefixosVivos++;

      // determinismo: o simulador não determinístico do JFLAP só tem uma configuração
      assert.deepEqual([...conjunto], [config.estado + '|' + config.pilha], `configuração diferente em "${palavra}"`);

      // mesmo veredito, pelo passo a passo e pela execução completa
      const aceitaRef = REF.aceita(conjunto);
      assert.equal(PDA.ehFinal(config.estado), aceitaRef, `veredito diferente em "${palavra}"`);
      assert.equal(PDA.executar(palavra).aceita, aceitaRef, `executar() diferente em "${palavra}"`);
      if (aceitaRef) aceitas.push(palavra);

      if (palavra.length === TAMANHO_MAXIMO) return;

      for (const x of SIMBOLOS_TESTE) {
        const r = PDA.passo(config, x);
        const proximo = REF.ler(conjunto, x);
        if (!r.ok) {
          assert.equal(proximo.size, 0, `o motor rejeitou "${palavra + x}" mas o .jff continua`);
          assert.equal(PDA.executar(palavra + x).aceita, false);
          ramosMortos++;
        } else {
          explorar(palavra + x, r.para, proximo);
        }
      }
    }

    explorar('', PDA.inicio(), REF.comecar());

    // Toda palavra aceita tem exatamente 3 pedaços e termina com b c
    assert.ok(aceitas.length > 0);
    for (const w of aceitas) {
      assert.equal([...w].filter((x) => x === 'a').length, 3, w);
      assert.ok(w.endsWith('bc'), w);
    }

    // Os 2 exemplos aceitos aparecem entre as palavras aceitas encontradas
    assert.ok(aceitas.includes('*saasasbc') && aceitas.includes('*casaasbc'));

    console.log(
      `      ${prefixosVivos} prefixos comparados, ${ramosMortos} ramos rejeitados pelos dois, ` +
      `${aceitas.length} palavras aceitas (todas com 3 pedaços)`
    );
  });
});
