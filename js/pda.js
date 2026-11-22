/* ===========================================================
   A Masmorra da Chave Partida — motor do autômato de pilha (PDA)

   Este arquivo contém apenas a lógica do autômato. Ele não sabe
   nada de tela, teclado ou mapa: recebe símbolos e devolve
   configurações (estado + pilha). Os dois modos do jogo usam o
   mesmo motor:
     - modo roteiro: PDA.executar('*saasasbc') processa a palavra toda;
     - modo WASD:    PDA.passo(config, 'a') processa um símbolo por vez,
                     no instante em que o personagem interage com um objeto.

   A definição abaixo é idêntica ao arquivo do JFLAP
   (jflap/masmorra-chave-partida.jff). Os testes em testes/ conferem
   essa igualdade automaticamente.

   Representação da pilha: uma string com o TOPO À ESQUERDA, a mesma
   notação do JFLAP. Ex.: 'HEZ' = H no topo, E no meio, Z no fundo.
   Assim, aplicar uma transição "x, desempilha ; empilha" é:
     nova pilha = empilha + (pilha sem o prefixo desempilhado)
   =========================================================== */
(function (raiz) {
  'use strict';

  /* ---------------------------------------------------------
     1. Definição formal: M = (Q, Σ, Γ, δ, q0, Z, F)
     --------------------------------------------------------- */

  var LAMBDA = '';          // λ (cadeia vazia) é representado por ''

  // Q: cada estado é uma sala da masmorra
  var ESTADOS = [
    { id: 'q0', sala: 'Entrada',          descricao: 'Estado inicial. Pegar a estrela-selo e escolher o caminho' },
    { id: 'q1', sala: 'Ala Oeste',        descricao: 'Coletar pedaços (caminho pelo corredor)' },
    { id: 'q2', sala: 'Ala Leste',        descricao: 'Coletar pedaços (caminho pelo portal azul)' },
    { id: 'q3', sala: 'Galeria Central',  descricao: 'Os dois caminhos se juntam. Coletar pedaços' },
    { id: 'q4', sala: 'Salão da Porta',   descricao: 'Usar a chave mestra na porta' },
    { id: 'q5', sala: 'Câmara do Portal', descricao: 'Entrar no portal final' },
    { id: 'q6', sala: 'Liberdade',        descricao: 'Estado final (aceitação)' }
  ];

  // Σ: alfabeto de entrada (ações do jogo)
  var ALFABETO = ['*', 'a', 's', 'b', 'c'];

  var ACOES = {
    '*': 'Coletar a estrela-selo',
    'a': 'Coletar um pedaço da chave',
    's': 'Abrir/atravessar uma passagem',
    'b': 'Utilizar a chave mestra na porta',
    'c': 'Entrar em um portal'
  };

  // Γ: alfabeto da pilha (o que pode estar na mochila)
  var ALFABETO_PILHA = ['Z', 'E', 'C', 'H', 'M'];

  var SIGNIFICADO_PILHA = {
    'Z': 'Fundo da pilha (mochila vazia)',
    'E': 'Estrela-selo',
    'C': 'Chave com 1 pedaço (só o cabo)',
    'H': 'Chave com 2 pedaços (cabo + haste)',
    'M': 'Chave mestra completa (3 pedaços)'
  };

  var ESTADO_INICIAL = 'q0';
  var SIMBOLO_INICIAL_PILHA = 'Z';
  var ESTADOS_FINAIS = ['q6'];

  // δ: as 17 transições, na mesma ordem e numeração do ESCOPO.
  // Notação do JFLAP: "le, desempilha ; empilha".
  var TRANSICOES = [
    { n: 1,  de: 'q0', para: 'q0', le: '*', desempilha: 'Z',    empilha: 'EZ',   significado: 'Pega a estrela-selo' },
    { n: 2,  de: 'q0', para: 'q1', le: 's', desempilha: 'E',    empilha: 'E',    significado: 'O corredor para a Ala Oeste só abre com o selo' },
    { n: 3,  de: 'q0', para: 'q2', le: 'c', desempilha: 'E',    empilha: 'E',    significado: 'O portal azul para a Ala Leste só ativa com o selo' },
    { n: 4,  de: 'q1', para: 'q1', le: 'a', desempilha: 'E',    empilha: 'CE',   significado: '1º pedaço: cabo' },
    { n: 5,  de: 'q1', para: 'q1', le: 'a', desempilha: 'C',    empilha: 'H',    significado: '2º pedaço: haste encaixa no cabo' },
    { n: 6,  de: 'q1', para: 'q1', le: 'a', desempilha: 'H',    empilha: 'M',    significado: '3º pedaço: chave mestra completa' },
    { n: 7,  de: 'q1', para: 'q3', le: 's', desempilha: LAMBDA, empilha: LAMBDA, significado: 'Grade da Ala Oeste para a Galeria Central' },
    { n: 8,  de: 'q2', para: 'q2', le: 'a', desempilha: 'E',    empilha: 'CE',   significado: '1º pedaço: cabo' },
    { n: 9,  de: 'q2', para: 'q2', le: 'a', desempilha: 'C',    empilha: 'H',    significado: '2º pedaço: haste encaixa no cabo' },
    { n: 10, de: 'q2', para: 'q2', le: 'a', desempilha: 'H',    empilha: 'M',    significado: '3º pedaço: chave mestra completa' },
    { n: 11, de: 'q2', para: 'q3', le: 's', desempilha: LAMBDA, empilha: LAMBDA, significado: 'Grade da Ala Leste para a Galeria Central' },
    { n: 12, de: 'q3', para: 'q3', le: 'a', desempilha: 'E',    empilha: 'CE',   significado: '1º pedaço: cabo' },
    { n: 13, de: 'q3', para: 'q3', le: 'a', desempilha: 'C',    empilha: 'H',    significado: '2º pedaço: haste encaixa no cabo' },
    { n: 14, de: 'q3', para: 'q3', le: 'a', desempilha: 'H',    empilha: 'M',    significado: '3º pedaço: chave mestra completa' },
    { n: 15, de: 'q3', para: 'q4', le: 's', desempilha: LAMBDA, empilha: LAMBDA, significado: 'Grade para o Salão da Porta' },
    { n: 16, de: 'q4', para: 'q5', le: 'b', desempilha: 'M',    empilha: LAMBDA, significado: 'A porta só abre com a chave mestra' },
    { n: 17, de: 'q5', para: 'q6', le: 'c', desempilha: 'E',    empilha: LAMBDA, significado: 'O selo libera o portal final' }
  ];

  // Os 4 exemplos sugeridos na interface (exigência do enunciado)
  var EXEMPLOS = [
    { roteiro: '*saasasbc',  caminho: 'Oeste', esperado: 'ACEITA',    explicacao: '2 pedaços na Ala Oeste e 1 na Galeria' },
    { roteiro: '*casaasbc',  caminho: 'Leste', esperado: 'ACEITA',    explicacao: '1 pedaço na Ala Leste e 2 na Galeria' },
    { roteiro: '*sasasbc',   caminho: 'Oeste', esperado: 'REJEITADA', explicacao: 'Chegou à porta com a chave incompleta (H no topo)' },
    { roteiro: '*caasaasbc', caminho: 'Leste', esperado: 'REJEITADA', explicacao: 'Tentou encaixar um 4º pedaço (M no topo)' }
  ];

  /* ---------------------------------------------------------
     2. Funções auxiliares
     --------------------------------------------------------- */

  function ehSimboloDeEntrada(simbolo) { return ALFABETO.indexOf(simbolo) !== -1; }
  function ehFinal(estado)            { return ESTADOS_FINAIS.indexOf(estado) !== -1; }
  function topo(pilha)                { return pilha.length ? pilha.charAt(0) : LAMBDA; }

  function sala(estado) {
    for (var i = 0; i < ESTADOS.length; i++) {
      if (ESTADOS[i].id === estado) return ESTADOS[i].sala;
    }
    return estado;
  }

  // Mostra λ no lugar da cadeia vazia
  function mostrar(cadeia) { return cadeia === LAMBDA ? 'λ' : cadeia; }

  // Rótulo da transição como aparece no JFLAP: "a, E ; CE"
  function rotulo(t) {
    return t.le + ', ' + mostrar(t.desempilha) + ' ; ' + mostrar(t.empilha);
  }

  /* ---------------------------------------------------------
     3. Execução
     Uma configuração é { estado, pilha }. As funções nunca alteram
     a configuração recebida: sempre devolvem uma nova.
     --------------------------------------------------------- */

  function inicio() {
    return { estado: ESTADO_INICIAL, pilha: SIMBOLO_INICIAL_PILHA };
  }

  // Transições que podem ser aplicadas a partir da configuração com o símbolo lido:
  // mesmo estado, mesmo símbolo e o "desempilha" casando com o topo
  // (desempilhar λ sempre casa, pois não exige nada da pilha).
  function transicoesAplicaveis(config, simbolo) {
    return TRANSICOES.filter(function (t) {
      return t.de === config.estado &&
             t.le === simbolo &&
             config.pilha.indexOf(t.desempilha) === 0;
    });
  }

  /**
   * Processa UM símbolo a partir de uma configuração.
   * Retorna:
   *   { ok: true,  de, simbolo, transicao, para }   se existe transição;
   *   { ok: false, de, simbolo, motivo }            se não existe (rejeição).
   */
  function passo(config, simbolo) {
    if (!ehSimboloDeEntrada(simbolo)) {
      return { ok: false, de: config, simbolo: simbolo, motivo: motivoSimboloInvalido(simbolo) };
    }

    var candidatas = transicoesAplicaveis(config, simbolo);

    // O PDA é determinístico: nunca há mais de uma transição aplicável.
    // Se isso acontecer, a tabela δ foi alterada de forma errada.
    if (candidatas.length > 1) {
      throw new Error('PDA não determinístico em (' + config.estado + ', ' + simbolo + ', ' + topo(config.pilha) + ')');
    }

    if (candidatas.length === 0) {
      return { ok: false, de: config, simbolo: simbolo, motivo: motivoSemTransicao(config, simbolo) };
    }

    var t = candidatas[0];
    var novaPilha = t.empilha + config.pilha.slice(t.desempilha.length);
    return {
      ok: true,
      de: config,
      simbolo: simbolo,
      transicao: t,
      para: { estado: t.para, pilha: novaPilha }
    };
  }

  /**
   * Processa um roteiro inteiro e devolve o rastreio passo a passo.
   *   passos[0]  = configuração inicial (nada lido ainda);
   *   passos[i]  = configuração depois de ler o i-ésimo símbolo.
   * A execução para no primeiro símbolo sem transição.
   */
  function executar(roteiro) {
    var config = inicio();
    var passos = [{ passo: 0, lido: null, transicao: null, estado: config.estado, pilha: config.pilha }];

    for (var i = 0; i < roteiro.length; i++) {
      var r = passo(config, roteiro.charAt(i));
      if (!r.ok) {
        return {
          roteiro: roteiro, passos: passos, aceita: false,
          parouEm: i, simboloRejeitado: r.simbolo, motivo: r.motivo
        };
      }
      config = r.para;
      passos.push({ passo: i + 1, lido: r.simbolo, transicao: r.transicao, estado: config.estado, pilha: config.pilha });
    }

    // Consumiu toda a entrada: aceita por ESTADO FINAL.
    var aceita = ehFinal(config.estado);
    return {
      roteiro: roteiro, passos: passos, aceita: aceita,
      parouEm: null, simboloRejeitado: null,
      motivo: aceita ? motivoAceita(config) : motivoFimForaDoFinal(roteiro, config)
    };
  }

  /* ---------------------------------------------------------
     4. Motivos (por que aceitou ou rejeitou)
     Cada motivo tem:
       codigo   — categoria formal (para os testes e a interface);
       situacao — o que aconteceu no jogo;
       texto    — explicação para o jogador;
       formal   — a mesma coisa na notação do PDA.
     --------------------------------------------------------- */

  function motivoSimboloInvalido(simbolo) {
    return {
      codigo: 'simbolo-invalido',
      situacao: 'simbolo-invalido',
      texto: 'O símbolo "' + simbolo + '" não faz parte do alfabeto do jogo.',
      formal: '"' + simbolo + '" ∉ Σ = { ' + ALFABETO.join(', ') + ' }'
    };
  }

  function motivoAceita(config) {
    return {
      codigo: 'aceita',
      situacao: 'liberdade',
      texto: 'O aventureiro atravessou o portal final e escapou da masmorra.',
      formal: 'Toda a entrada foi consumida e ' + config.estado + ' ∈ F = { ' + ESTADOS_FINAIS.join(', ') + ' }'
    };
  }

  function motivoFimForaDoFinal(roteiro, config) {
    var vazio = roteiro.length === 0;
    return {
      codigo: vazio ? 'roteiro-vazio' : 'fim-fora-do-final',
      situacao: vazio ? 'roteiro-vazio' : 'nao-escapou',
      texto: vazio
        ? 'O roteiro está vazio: o aventureiro nem saiu da Entrada.'
        : 'O roteiro acabou com o aventureiro em ' + sala(config.estado) + ', sem atravessar o portal final.',
      formal: 'Toda a entrada foi consumida em ' + config.estado + ' ∉ F = { ' + ESTADOS_FINAIS.join(', ') + ' }'
    };
  }

  // Sem transição: explica a regra do jogo que impediu a ação.
  function motivoSemTransicao(config, simbolo) {
    var q = config.estado;
    var t = topo(config.pilha);
    var formal = 'δ(' + q + ', ' + simbolo + ', ' + mostrar(t) + ') não está definida';
    var situacao, texto;

    if (config.pilha.length === 0) {
      // Não ocorre neste PDA (Z nunca sai sem ser reposto), mas é tratado
      // para que o motor nunca tente desempilhar de uma pilha vazia.
      return {
        codigo: 'pilha-vazia', situacao: 'pilha-vazia',
        texto: 'A mochila está vazia: não há nada para desempilhar.',
        formal: formal + ' (pilha vazia)'
      };
    }

    if (q === 'q6') {
      situacao = 'jogo-terminado';
      texto = 'O aventureiro já escapou: depois da Liberdade não há mais ações.';
    } else if (simbolo === '*') {
      situacao = 'estrela-indisponivel';
      texto = q === 'q0'
        ? 'A estrela-selo já está na mochila: só existe uma.'
        : 'A estrela-selo só existe na Entrada e só pode ser coletada uma vez.';
    } else if ((simbolo === 's' || simbolo === 'c') && q === 'q0') {
      situacao = 'sem-estrela';
      texto = 'A saída da Entrada está selada: é preciso pegar a estrela-selo antes (' + t + ' no topo).';
    } else if (simbolo === 'a' && t === 'M') {
      situacao = 'quarto-pedaco';
      texto = 'A chave mestra já está completa (M no topo): um 4º pedaço não encaixa e a quebra.';
    } else if (simbolo === 'a') {
      situacao = 'sem-pedaco';
      texto = 'Não há pedaços da chave em ' + sala(q) + '.';
    } else if (simbolo === 'b' && q === 'q4') {
      situacao = 'chave-incompleta';
      texto = 'A porta só abre com a chave mestra, mas o topo da mochila é ' + t +
              (t === 'C' || t === 'H' ? ' (chave incompleta).' : ' (nenhuma chave).');
    } else if (simbolo === 'b') {
      situacao = 'sem-porta';
      texto = 'Não há porta em ' + sala(q) + '.';
    } else if (simbolo === 'c') {
      situacao = 'sem-portal';
      texto = q === 'q1'
        ? 'Não há portal na Ala Oeste: o portal azul ficou para trás, na Entrada.'
        : 'Não há portal em ' + sala(q) + '.';
    } else if (simbolo === 's') {
      situacao = 'sem-passagem';
      texto = q === 'q4'
        ? 'A única saída do Salão da Porta é a porta mestra.'
        : 'Não há passagem em ' + sala(q) + '.';
    } else {
      situacao = 'sem-transicao';
      texto = 'Essa ação não é possível nesta situação.';
    }

    return { codigo: 'sem-transicao', situacao: situacao, texto: texto, formal: formal };
  }

  /* ---------------------------------------------------------
     5. Interface pública do motor
     --------------------------------------------------------- */

  function congelar(lista) {
    lista.forEach(function (item) { if (typeof item === 'object') Object.freeze(item); });
    return Object.freeze(lista);
  }

  var PDA = Object.freeze({
    LAMBDA: LAMBDA,
    ESTADOS: congelar(ESTADOS),
    ALFABETO: congelar(ALFABETO),
    ACOES: Object.freeze(ACOES),
    ALFABETO_PILHA: congelar(ALFABETO_PILHA),
    SIGNIFICADO_PILHA: Object.freeze(SIGNIFICADO_PILHA),
    ESTADO_INICIAL: ESTADO_INICIAL,
    SIMBOLO_INICIAL_PILHA: SIMBOLO_INICIAL_PILHA,
    ESTADOS_FINAIS: congelar(ESTADOS_FINAIS),
    TRANSICOES: congelar(TRANSICOES),
    EXEMPLOS: congelar(EXEMPLOS),

    inicio: inicio,
    passo: passo,
    executar: executar,
    transicoesAplicaveis: transicoesAplicaveis,
    ehFinal: ehFinal,
    ehSimboloDeEntrada: ehSimboloDeEntrada,
    topo: topo,
    sala: sala,
    rotulo: rotulo,
    mostrar: mostrar
  });

  // No navegador vira window.PDA; no Node (testes) é exportado como módulo.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDA;
  } else {
    raiz.PDA = PDA;
  }
})(typeof window !== 'undefined' ? window : this);
