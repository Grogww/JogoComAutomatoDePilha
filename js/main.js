/* ===========================================================
   A Masmorra da Chave Partida — controle da página

   Liga as três partes:
     PDA    (js/pda.js)    o motor: decide se cada símbolo tem transição;
     Mapa   (js/mapa.js)   o desenho e o movimento WASD;
     Painel (js/painel.js) estado, símbolo, pilha, tabelas e diagrama.

   Fluxo do modo Explorar (WASD):
     tecla → Mapa.mover() → o aventureiro encosta num objeto →
     aoInteragir(símbolo) → PDA.executar(roteiro + símbolo) →
     Painel.render() → o mapa reage (pega o item, abre a passagem
     ou encerra o jogo com REJEITADA/ACEITA).

   Fluxo do modo Roteiro (letras):
     texto digitado → PDA.executar(roteiro) → navegação passo a passo →
     Painel.render(pos) e o mapa acende a sala do estado em cada passo.
   =========================================================== */
(function (raiz) {
  'use strict';

  var PDA = raiz.PDA, Mapa = raiz.Mapa, Painel = raiz.Painel;
  function $(id) { return document.getElementById(id); }
  var reduzido = raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var modo = 'explorar';

  // Modo Explorar: o roteiro nasce do movimento, um símbolo por interação
  var explorar = { roteiro: '', exec: PDA.executar('') };

  // Modo Roteiro: o roteiro é digitado; pos é a configuração mostrada
  var roteiro = { texto: '', exec: PDA.executar(''), pos: 0, timer: null };

  /* ---------------------------------------------------------
     1. Modo Explorar
     --------------------------------------------------------- */

  function aoInteragir(simbolo, onde) {
    explorar.roteiro += simbolo;
    explorar.exec = PDA.executar(explorar.roteiro);
    var rejeitou = explorar.exec.parouEm != null;

    Painel.render(explorar.exec, null, { emCurso: !rejeitou, fita: $('fita-explorar'), animar: true });
    $('btn-levar-roteiro').disabled = false;

    if (rejeitou) {
      setTimeout(function () { mostrarDesfecho(false); }, reduzido ? 0 : 650);
    } else if ((simbolo === 'a' || simbolo === '*') && onde) {
      voarParaPilha(onde, simbolo);
    }
    return { ok: !rejeitou, aceita: explorar.exec.aceita };
  }

  function aoMudarSala(estado) {
    var faixa = $('faixa-sala');
    faixa.textContent = '';
    faixa.appendChild(document.createTextNode(PDA.sala(estado)));
    var q = document.createElement('small');
    q.textContent = 'estado ' + estado;
    faixa.appendChild(q);
    faixa.classList.remove('aparece');
    void faixa.offsetWidth;
    faixa.classList.add('aparece');
    if (PDA.ehFinal(estado)) {
      Painel.render(explorar.exec, null, { emCurso: false, fita: $('fita-explorar') });
      setTimeout(function () { mostrarDesfecho(true); }, reduzido ? 0 : 500);
    }
  }

  // A peça (ou a estrela) voa do mapa até o nicho do topo da pilha
  function voarParaPilha(onde, simbolo) {
    if (reduzido || !document.body.animate) return;
    var de = Mapa.pontoNaTela(onde.x, onde.y);
    var para = Painel.pontoDoTopo();
    if (!para) return;
    var v = document.createElement('div');
    v.className = 'voo';
    v.textContent = simbolo === '*' ? 'E' : PDA.topo(explorar.exec.passos[explorar.exec.passos.length - 1].pilha);
    v.style.left = (de.x - 17) + 'px';
    v.style.top = (de.y - 17) + 'px';
    document.body.appendChild(v);
    var dx = para.x - de.x, dy = para.y - de.y;
    var anim = v.animate([
      { transform: 'translate(0,0) scale(0.6)', opacity: 0 },
      { transform: 'translate(' + dx * 0.35 + 'px,' + (dy * 0.35 - 60) + 'px) scale(1.15)', opacity: 1, offset: 0.35 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.8)', opacity: 0.2 }
    ], { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    anim.onfinish = function () { v.remove(); };
  }

  function mostrarDesfecho(aceita) {
    var d = $('desfecho');
    d.className = 'desfecho ' + (aceita ? 'desfecho--aceita' : 'desfecho--rejeitada');
    $('desfecho-veredito').textContent = aceita ? 'ACEITA' : 'REJEITADA';
    $('desfecho-texto').textContent = explorar.exec.motivo.texto;
    $('desfecho-formal').textContent = explorar.exec.motivo.formal;
    $('desfecho-roteiro').textContent = explorar.roteiro;
    d.hidden = false;
    $('btn-desfecho-reiniciar').focus({ preventScroll: true });
  }

  function reiniciarExplorar() {
    Mapa.reiniciar();
    explorar.roteiro = '';
    explorar.exec = PDA.executar('');
    $('desfecho').hidden = true;
    $('btn-levar-roteiro').disabled = true;
    Painel.reiniciarPilha();
    Painel.render(explorar.exec, null, { emCurso: true, fita: $('fita-explorar') });
  }

  /* ---------------------------------------------------------
     2. Modo Roteiro
     --------------------------------------------------------- */

  function definirRoteiro(texto, irParaFim) {
    roteiro.texto = String(texto).replace(/\s+/g, '').slice(0, 40);
    if ($('entrada-roteiro').value !== roteiro.texto) $('entrada-roteiro').value = roteiro.texto;
    roteiro.exec = PDA.executar(roteiro.texto);
    roteiro.pos = irParaFim ? roteiro.exec.passos.length - 1 : 0;
    Painel.reiniciarPilha();
    mostrarRoteiro(false);
  }

  function mostrarRoteiro(animar) {
    var visitados = Painel.render(roteiro.exec, roteiro.pos, { emCurso: false, fita: $('fita-roteiro'), animar: animar, aguardando: roteiro.texto === '' });
    var estado = roteiro.exec.passos[roteiro.pos].estado;
    Mapa.mostrarEstado(estado, visitados);

    var ultimo = roteiro.exec.passos.length - 1;
    $('btn-inicio').disabled = roteiro.pos === 0;
    $('btn-voltar').disabled = roteiro.pos === 0;
    $('btn-avancar').disabled = roteiro.pos >= ultimo;
    $('btn-fim').disabled = roteiro.pos >= ultimo;
    $('btn-executar').textContent = roteiro.timer ? 'Pausar' : 'Executar';

    Array.prototype.forEach.call(document.querySelectorAll('.exemplo'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.roteiro === roteiro.texto ? 'true' : 'false');
    });
  }

  function irPara(pos) {
    var ultimo = roteiro.exec.passos.length - 1;
    var novo = Math.max(0, Math.min(pos, ultimo));
    var avancou = novo === roteiro.pos + 1;
    roteiro.pos = novo;
    mostrarRoteiro(avancou);
  }

  function pararAuto() {
    if (roteiro.timer) { clearInterval(roteiro.timer); roteiro.timer = null; }
  }

  function alternarAuto() {
    if (roteiro.timer) { pararAuto(); mostrarRoteiro(false); return; }
    if (roteiro.pos >= roteiro.exec.passos.length - 1) { roteiro.pos = 0; Painel.reiniciarPilha(); }
    roteiro.timer = setInterval(function () {
      if (roteiro.pos >= roteiro.exec.passos.length - 1) { pararAuto(); mostrarRoteiro(false); return; }
      irPara(roteiro.pos + 1);
    }, reduzido ? 250 : 700);
    mostrarRoteiro(false);
  }

  function montarExemplos() {
    var lista = $('exemplos');
    PDA.EXEMPLOS.forEach(function (ex) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'exemplo';
      b.dataset.roteiro = ex.roteiro;
      var palavra = document.createElement('span');
      palavra.className = 'exemplo__palavra';
      palavra.textContent = ex.roteiro;
      var nota = document.createElement('span');
      nota.className = 'exemplo__nota';
      var veredito = document.createElement('b');
      veredito.className = ex.esperado === 'ACEITA' ? 'sim' : 'nao';
      veredito.textContent = ex.esperado;
      nota.appendChild(veredito);
      nota.appendChild(document.createTextNode(' · Ala ' + ex.caminho));
      b.title = ex.explicacao;
      var porque = document.createElement('span');
      porque.className = 'exemplo__nota';
      porque.textContent = ex.explicacao;
      b.appendChild(palavra);
      b.appendChild(nota);
      b.appendChild(porque);
      b.addEventListener('click', function () {
        pararAuto();
        definirRoteiro(ex.roteiro, false);
        alternarAuto();
      });
      li.appendChild(b);
      lista.appendChild(li);
    });
  }

  /* ---------------------------------------------------------
     3. Troca de modo
     --------------------------------------------------------- */

  function trocarModo(novo) {
    if (novo === modo) return;
    modo = novo;
    pararAuto();
    var exp = novo === 'explorar';
    $('aba-explorar').setAttribute('aria-selected', String(exp));
    $('aba-roteiro').setAttribute('aria-selected', String(!exp));
    $('barra-explorar').hidden = !exp;
    $('barra-roteiro').hidden = exp;
    $('dica-mapa').classList.add('some');
    Painel.reiniciarPilha();
    if (exp) {
      Mapa.sairDaVitrine();
      $('desfecho').hidden = !Mapa.encerrado();
      Painel.render(explorar.exec, null, { emCurso: explorar.exec.parouEm == null && !explorar.exec.aceita, fita: $('fita-explorar') });
    } else {
      $('desfecho').hidden = true;
      mostrarRoteiro(false);
    }
  }

  /* ---------------------------------------------------------
     4. Teclado e botões
     --------------------------------------------------------- */

  var DIRECOES = {
    w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
    arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0]
  };

  function emCampoDeTexto(alvo) {
    return alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
  }

  function ligarTeclado() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Com o campo do roteiro em foco, o teclado escreve letras e não move ninguém.
      if (emCampoDeTexto(e.target)) return;
      var k = e.key.toLowerCase();

      if (modo === 'explorar') {
        var dir = DIRECOES[k];
        if (!dir) return;
        e.preventDefault();
        Mapa.mover(dir[0], dir[1]);
        return;
      }

      // modo Roteiro: setas navegam pelos passos
      if (k === 'arrowright') { pararAuto(); irPara(roteiro.pos + 1); }
      else if (k === 'arrowleft') { pararAuto(); irPara(roteiro.pos - 1); }
      else if (k === 'home') { pararAuto(); irPara(0); }
      else if (k === 'end') { pararAuto(); irPara(roteiro.exec.passos.length - 1); }
      else return;
      e.preventDefault();
    });
  }

  function ligarBotoes() {
    $('aba-explorar').addEventListener('click', function () { trocarModo('explorar'); });
    $('aba-roteiro').addEventListener('click', function () { trocarModo('roteiro'); });
    $('btn-reiniciar').addEventListener('click', function () {
      if (modo === 'explorar') reiniciarExplorar();
      else { pararAuto(); definirRoteiro('', false); $('entrada-roteiro').focus(); }
    });

    $('btn-desfecho-reiniciar').addEventListener('click', reiniciarExplorar);
    $('btn-desfecho-roteiro').addEventListener('click', levarAoRoteiro);
    $('btn-levar-roteiro').addEventListener('click', levarAoRoteiro);

    $('entrada-roteiro').addEventListener('input', function (e) { pararAuto(); definirRoteiro(e.target.value, true); });
    $('entrada-roteiro').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); pararAuto(); definirRoteiro(e.target.value, false); alternarAuto(); }
    });
    $('btn-inicio').addEventListener('click', function () { pararAuto(); irPara(0); });
    $('btn-voltar').addEventListener('click', function () { pararAuto(); irPara(roteiro.pos - 1); });
    $('btn-avancar').addEventListener('click', function () { pararAuto(); irPara(roteiro.pos + 1); });
    $('btn-fim').addEventListener('click', function () { pararAuto(); irPara(roteiro.exec.passos.length - 1); });
    $('btn-executar').addEventListener('click', alternarAuto);

    Array.prototype.forEach.call(document.querySelectorAll('.dpad button'), function (b) {
      var d = { cima: [0, -1], esquerda: [-1, 0], baixo: [0, 1], direita: [1, 0] }[b.dataset.dir];
      b.addEventListener('click', function () { Mapa.mover(d[0], d[1]); });
    });
  }

  // O roteiro gerado andando vira um roteiro digitado: mesmo motor, mesmo resultado
  function levarAoRoteiro() {
    var texto = explorar.roteiro;
    trocarModo('roteiro');
    definirRoteiro(texto, false);
    alternarAuto();
  }

  /* ---------------------------------------------------------
     5. Início
     --------------------------------------------------------- */

  Painel.montar();
  montarExemplos();
  Mapa.iniciar($('mapa'), {
    aoInteragir: aoInteragir,
    aoMudarSala: aoMudarSala,
    aoAndar: function () { $('dica-mapa').classList.add('some'); }
  });
  ligarTeclado();
  ligarBotoes();
  Painel.render(explorar.exec, null, { emCurso: true, fita: $('fita-explorar') });
  definirRoteiro('', false);
  // definirRoteiro desenha o modo Roteiro; volta a mostrar o Explorar
  Mapa.sairDaVitrine();
  Painel.reiniciarPilha();
  Painel.render(explorar.exec, null, { emCurso: true, fita: $('fita-explorar') });
})(window);
