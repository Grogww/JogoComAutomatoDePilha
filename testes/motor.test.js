/* ===========================================================
   Testes do motor do PDA (js/pda.js)

   Conferem a definição formal, o determinismo, os exemplos e
   rastreios do escopo, os motivos de rejeição e os casos de borda.

   Como rodar (Node 18 ou superior), na pasta do repositório:
     node --test
   =========================================================== */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const PDA = require('../js/pda.js');

// Converte o rastreio do motor no formato das tabelas do escopo: [estado, lido, pilha]
function rastreio(roteiro) {
  return PDA.executar(roteiro).passos.map((p) => [p.estado, p.lido, p.pilha]);
}

describe('Definição formal M = (Q, Σ, Γ, δ, q0, Z, F)', () => {
  it('Q tem 7 estados (q0 a q6), dentro do limite de 5 a 10 do enunciado', () => {
    assert.deepEqual(PDA.ESTADOS.map((e) => e.id), ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
    assert.ok(PDA.ESTADOS.length >= 5 && PDA.ESTADOS.length <= 10);
  });

  it('cada estado é uma sala da masmorra', () => {
    assert.deepEqual(PDA.ESTADOS.map((e) => e.sala), [
      'Entrada', 'Ala Oeste', 'Ala Leste', 'Galeria Central',
      'Salão da Porta', 'Câmara do Portal', 'Liberdade'
    ]);
  });

  it('Σ = { *, a, s, b, c }, os símbolos do exemplo do enunciado', () => {
    assert.deepEqual([...PDA.ALFABETO], ['*', 'a', 's', 'b', 'c']);
  });

  it('Γ = { Z, E, C, H, M }', () => {
    assert.deepEqual([...PDA.ALFABETO_PILHA], ['Z', 'E', 'C', 'H', 'M']);
  });

  it('q0 é o estado inicial, Z o símbolo inicial da pilha e F = { q6 }', () => {
    assert.equal(PDA.ESTADO_INICIAL, 'q0');
    assert.equal(PDA.SIMBOLO_INICIAL_PILHA, 'Z');
    assert.deepEqual([...PDA.ESTADOS_FINAIS], ['q6']);
    assert.deepEqual(PDA.inicio(), { estado: 'q0', pilha: 'Z' });
  });

  it('δ tem 17 transições, numeradas de 1 a 17 na ordem do escopo', () => {
    assert.equal(PDA.TRANSICOES.length, 17);
    PDA.TRANSICOES.forEach((t, i) => assert.equal(t.n, i + 1));
  });

  it('a tabela δ é exatamente a do ESCOPO.md', () => {
    const esperado = [
      'q0 → q0 : *, Z ; EZ',
      'q0 → q1 : s, E ; E',
      'q0 → q2 : c, E ; E',
      'q1 → q1 : a, E ; CE',
      'q1 → q1 : a, C ; H',
      'q1 → q1 : a, H ; M',
      'q1 → q3 : s, λ ; λ',
      'q2 → q2 : a, E ; CE',
      'q2 → q2 : a, C ; H',
      'q2 → q2 : a, H ; M',
      'q2 → q3 : s, λ ; λ',
      'q3 → q3 : a, E ; CE',
      'q3 → q3 : a, C ; H',
      'q3 → q3 : a, H ; M',
      'q3 → q4 : s, λ ; λ',
      'q4 → q5 : b, M ; λ',
      'q5 → q6 : c, E ; λ'
    ];
    assert.deepEqual(PDA.TRANSICOES.map((t) => t.de + ' → ' + t.para + ' : ' + PDA.rotulo(t)), esperado);
  });

  it('toda transição usa apenas elementos de Q, Σ e Γ', () => {
    const Q = PDA.ESTADOS.map((e) => e.id);
    for (const t of PDA.TRANSICOES) {
      assert.ok(Q.includes(t.de) && Q.includes(t.para), 'estado fora de Q na transição ' + t.n);
      assert.ok(PDA.ALFABETO.includes(t.le), 'símbolo fora de Σ na transição ' + t.n);
      for (const g of t.desempilha + t.empilha) {
        assert.ok(PDA.ALFABETO_PILHA.includes(g), 'símbolo fora de Γ na transição ' + t.n);
      }
      // desempilha um único símbolo de Γ ou λ (Γ ∪ {λ}), como na definição de PDA
      assert.ok(t.desempilha.length <= 1, 'desempilha mais de um símbolo na transição ' + t.n);
    }
  });

  it('os dados do motor não podem ser alterados por engano (estão congelados)', () => {
    assert.ok(Object.isFrozen(PDA.TRANSICOES));
    assert.ok(Object.isFrozen(PDA.TRANSICOES[0]));
    assert.ok(Object.isFrozen(PDA.ESTADOS));
  });
});

describe('Determinismo', () => {
  it('não há transições que leem λ (toda transição consome um símbolo)', () => {
    assert.ok(PDA.TRANSICOES.every((t) => t.le !== PDA.LAMBDA));
  });

  it('para cada (estado, símbolo, topo) existe no máximo uma transição aplicável', () => {
    for (const q of PDA.ESTADOS.map((e) => e.id)) {
      for (const x of PDA.ALFABETO) {
        const grupo = PDA.TRANSICOES.filter((t) => t.de === q && t.le === x);
        // se alguma desempilha λ, ela casa com qualquer topo: precisa ser a única
        if (grupo.some((t) => t.desempilha === PDA.LAMBDA)) {
          assert.equal(grupo.length, 1, `conflito com λ em (${q}, ${x})`);
        }
        const topos = grupo.map((t) => t.desempilha);
        assert.equal(new Set(topos).size, topos.length, `topo repetido em (${q}, ${x})`);
      }
    }
  });
});

describe('Os 4 exemplos da interface', () => {
  it('são 4, com 2 aceitos e 2 rejeitados, cobrindo as duas rotas', () => {
    assert.equal(PDA.EXEMPLOS.length, 4);
    assert.equal(PDA.EXEMPLOS.filter((e) => e.esperado === 'ACEITA').length, 2);
    assert.deepEqual(new Set(PDA.EXEMPLOS.map((e) => e.caminho)), new Set(['Oeste', 'Leste']));
  });

  for (const ex of PDA.EXEMPLOS) {
    it(`${ex.roteiro} → ${ex.esperado} (${ex.explicacao})`, () => {
      assert.equal(PDA.executar(ex.roteiro).aceita, ex.esperado === 'ACEITA');
    });
  }
});

describe('Rastreios do ESCOPO.md (estado, símbolo lido, pilha com topo à esquerda)', () => {
  it('*saasasbc: ACEITA pela Ala Oeste', () => {
    assert.deepEqual(rastreio('*saasasbc'), [
      ['q0', null, 'Z'], ['q0', '*', 'EZ'], ['q1', 's', 'EZ'], ['q1', 'a', 'CEZ'], ['q1', 'a', 'HEZ'],
      ['q3', 's', 'HEZ'], ['q3', 'a', 'MEZ'], ['q4', 's', 'MEZ'], ['q5', 'b', 'EZ'], ['q6', 'c', 'Z']
    ]);
    const r = PDA.executar('*saasasbc');
    assert.equal(r.aceita, true);
    assert.equal(r.motivo.codigo, 'aceita');
  });

  it('*casaasbc: ACEITA pela Ala Leste', () => {
    assert.deepEqual(rastreio('*casaasbc'), [
      ['q0', null, 'Z'], ['q0', '*', 'EZ'], ['q2', 'c', 'EZ'], ['q2', 'a', 'CEZ'], ['q3', 's', 'CEZ'],
      ['q3', 'a', 'HEZ'], ['q3', 'a', 'MEZ'], ['q4', 's', 'MEZ'], ['q5', 'b', 'EZ'], ['q6', 'c', 'Z']
    ]);
    assert.equal(PDA.executar('*casaasbc').aceita, true);
  });

  it('*sasasbc: REJEITADA no 7º símbolo, δ(q4, b, H) não existe', () => {
    assert.deepEqual(rastreio('*sasasbc'), [
      ['q0', null, 'Z'], ['q0', '*', 'EZ'], ['q1', 's', 'EZ'], ['q1', 'a', 'CEZ'],
      ['q3', 's', 'CEZ'], ['q3', 'a', 'HEZ'], ['q4', 's', 'HEZ']
    ]);
    const r = PDA.executar('*sasasbc');
    assert.equal(r.aceita, false);
    assert.equal(r.parouEm, 6);
    assert.equal(r.simboloRejeitado, 'b');
    assert.equal(r.motivo.situacao, 'chave-incompleta');
    assert.equal(r.motivo.formal, 'δ(q4, b, H) não está definida');
  });

  it('*caasaasbc: REJEITADA no 7º símbolo, δ(q3, a, M) não existe', () => {
    assert.deepEqual(rastreio('*caasaasbc'), [
      ['q0', null, 'Z'], ['q0', '*', 'EZ'], ['q2', 'c', 'EZ'], ['q2', 'a', 'CEZ'],
      ['q2', 'a', 'HEZ'], ['q3', 's', 'HEZ'], ['q3', 'a', 'MEZ']
    ]);
    const r = PDA.executar('*caasaasbc');
    assert.equal(r.parouEm, 6);
    assert.equal(r.motivo.situacao, 'quarto-pedaco');
    assert.equal(r.motivo.formal, 'δ(q3, a, M) não está definida');
  });

  it('cada passo do rastreio guarda a transição usada', () => {
    const numeros = PDA.executar('*saasasbc').passos.map((p) => (p.transicao ? p.transicao.n : null));
    assert.deepEqual(numeros, [null, 1, 2, 4, 5, 7, 14, 15, 16, 17]);
  });
});

describe('Motivos de rejeição (tabela do ESCOPO.md)', () => {
  const casos = [
    // roteiro,      codigo,              situacao,               parouEm
    ['saas',         'sem-transicao',     'sem-estrela',          0],
    ['caas',         'sem-transicao',     'sem-estrela',          0],
    ['*saasaa',      'sem-transicao',     'quarto-pedaco',        6],
    ['*sasasbc',     'sem-transicao',     'chave-incompleta',     6],
    ['*sssbc',       'sem-transicao',     'chave-incompleta',     4],
    ['**',           'sem-transicao',     'estrela-indisponivel', 1],
    ['*sc',          'sem-transicao',     'sem-portal',           2],
    ['*sx',          'simbolo-invalido',  'simbolo-invalido',     2],
    ['*saasasb',     'fim-fora-do-final', 'nao-escapou',          null],
    ['',             'roteiro-vazio',     'roteiro-vazio',        null],
    ['*saasasbcc',   'sem-transicao',     'jogo-terminado',       9],
    ['a',            'sem-transicao',     'sem-pedaco',           0],
    ['*sb',          'sem-transicao',     'sem-porta',            2],
    ['*saaassss',    'sem-transicao',     'sem-passagem',         7]
  ];

  for (const [roteiro, codigo, situacao, parouEm] of casos) {
    it(`"${roteiro}" → ${codigo} / ${situacao}`, () => {
      const r = PDA.executar(roteiro);
      assert.equal(r.aceita, false);
      assert.equal(r.motivo.codigo, codigo);
      assert.equal(r.motivo.situacao, situacao);
      assert.equal(r.parouEm, parouEm);
      assert.ok(r.motivo.texto.length > 0 && r.motivo.formal.length > 0);
    });
  }

  it('o rastreio de uma rejeição termina na última configuração válida', () => {
    const r = PDA.executar('*saasaa');
    assert.equal(r.passos.length, 7);           // configuração inicial + 6 símbolos aceitos
    assert.deepEqual(r.passos.at(-1), { passo: 6, lido: 'a', transicao: PDA.TRANSICOES[13], estado: 'q3', pilha: 'MEZ' });
    assert.equal(r.simboloRejeitado, 'a');
  });
});

describe('Casos de borda', () => {
  it('roteiro vazio é rejeitado (q0 ∉ F)', () => {
    const r = PDA.executar('');
    assert.equal(r.aceita, false);
    assert.equal(r.passos.length, 1);
    assert.equal(r.motivo.formal, 'Toda a entrada foi consumida em q0 ∉ F = { q6 }');
  });

  it('letras maiúsculas, espaços e outros caracteres não pertencem a Σ', () => {
    for (const x of ['A', 'S', ' ', 'x', 'w', '1', 'λ', '']) {
      const r = PDA.passo(PDA.inicio(), x);
      assert.equal(r.ok, false);
      assert.equal(r.motivo.codigo, 'simbolo-invalido');
    }
  });

  it('o motor nunca desempilha de uma pilha vazia: informa o motivo em vez de falhar', () => {
    const r = PDA.passo({ estado: 'q4', pilha: '' }, 'b');
    assert.equal(r.ok, false);
    assert.equal(r.motivo.codigo, 'pilha-vazia');
  });

  it('passo() não altera a configuração recebida', () => {
    const config = { estado: 'q1', pilha: 'EZ' };
    const r = PDA.passo(config, 'a');
    assert.deepEqual(config, { estado: 'q1', pilha: 'EZ' });
    assert.deepEqual(r.para, { estado: 'q1', pilha: 'CEZ' });
    assert.notEqual(r.para, config);
  });

  it('desempilhar λ (grades) não altera a pilha', () => {
    for (const pilha of ['EZ', 'CEZ', 'HEZ', 'MEZ']) {
      assert.deepEqual(PDA.passo({ estado: 'q1', pilha }, 's').para, { estado: 'q3', pilha });
    }
  });

  it('a estrela fica no fundo e só volta ao topo depois que a chave mestra é usada (LIFO)', () => {
    const passos = PDA.executar('*saasasbc').passos;
    assert.equal(PDA.topo(passos[7].pilha), 'M');   // antes da porta: chave mestra no topo
    assert.equal(PDA.topo(passos[8].pilha), 'E');   // depois de b: o selo volta ao topo
    assert.equal(passos[9].pilha, 'Z');             // o portal final consome o selo
  });
});

describe('Modo WASD: símbolos processados um a um', () => {
  it('chamar passo() a cada interação dá o mesmo resultado que executar() o roteiro gerado', () => {
    for (const roteiro of ['*saasasbc', '*casaasbc', '*sasasbc', '*caasaasbc', '*saasasb']) {
      const completo = PDA.executar(roteiro);
      let config = PDA.inicio();
      let i = 0;
      for (; i < roteiro.length; i++) {
        const r = PDA.passo(config, roteiro[i]);
        if (!r.ok) break;
        assert.deepEqual(r.para, { estado: completo.passos[i + 1].estado, pilha: completo.passos[i + 1].pilha });
        config = r.para;
      }
      assert.equal(i === roteiro.length && PDA.ehFinal(config.estado), completo.aceita);
    }
  });
});

describe('Configurações alcançáveis', () => {
  // Busca em largura a partir da configuração inicial, lendo qualquer símbolo de Σ.
  function alcancaveis() {
    const vistas = new Map();
    const fila = [PDA.inicio()];
    while (fila.length) {
      const c = fila.shift();
      const chave = c.estado + '|' + c.pilha;
      if (vistas.has(chave)) continue;
      vistas.set(chave, c);
      for (const x of PDA.ALFABETO) {
        const r = PDA.passo(c, x);
        if (r.ok) fila.push(r.para);
      }
    }
    return [...vistas.keys()].sort();
  }

  it('são exatamente as 20 configurações esperadas (a pilha nunca passa de 3 símbolos)', () => {
    const esperado = [
      'q0|Z', 'q0|EZ',
      'q1|EZ', 'q1|CEZ', 'q1|HEZ', 'q1|MEZ',
      'q2|EZ', 'q2|CEZ', 'q2|HEZ', 'q2|MEZ',
      'q3|EZ', 'q3|CEZ', 'q3|HEZ', 'q3|MEZ',
      'q4|EZ', 'q4|CEZ', 'q4|HEZ', 'q4|MEZ',
      'q5|EZ',
      'q6|Z'
    ].sort();
    assert.deepEqual(alcancaveis(), esperado);
  });

  it('todos os estados são alcançáveis e o fundo da pilha é sempre Z', () => {
    const lista = alcancaveis();
    for (const q of PDA.ESTADOS.map((e) => e.id)) {
      assert.ok(lista.some((c) => c.startsWith(q + '|')), q + ' inalcançável');
    }
    assert.ok(lista.every((c) => c.endsWith('Z')));
  });
});
