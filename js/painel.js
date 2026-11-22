/* ===========================================================
   A Masmorra da Chave Partida — painel do autômato

   Desenha tudo o que mostra o PDA na página:
     - a placa fixa (estado, símbolo processado, pilha, transição, veredito);
     - a fita com os símbolos;
     - a definição formal, a legenda de Σ e Γ, a tabela δ;
     - o diagrama de estados (SVG) e o rastreio passo a passo.
   Todos os dados vêm de window.PDA (js/pda.js): nada é copiado à mão.
   =========================================================== */
(function (raiz) {
  'use strict';

  var PDA = raiz.PDA;
  function $(id) { return document.getElementById(id); }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, texto) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texto != null) e.textContent = texto;
    return e;
  }

  var mostrar = PDA.mostrar;
  function deltaFormal(t) {
    return 'δ(' + t.de + ', ' + t.le + ', ' + mostrar(t.desempilha) + ') = (' + t.para + ', ' + mostrar(t.empilha) + ')';
  }

  /* ---------------------------------------------------------
     1. Partes fixas: legenda, definição formal, tabela δ
     --------------------------------------------------------- */

  var NO_MAPA = {
    '*': 'Encostar na estrela-selo, no meio da Entrada',
    'a': 'Encostar num pedaço da chave (3 por sala de coleta)',
    's': 'Atravessar o corredor ou uma grade',
    'b': 'Encostar na porta do Salão',
    'c': 'Entrar no portal azul (Entrada) ou no portal final'
  };
  var EFEITO = {
    '*': 'Empilha E (o selo vai para o fundo da mochila)',
    'a': 'Encaixa o pedaço: E → CE, C → H, H → M',
    's': 'Muda de sala; o corredor exige E no topo',
    'b': 'Desempilha M (a chave mestra é usada)',
    'c': 'Portal azul exige E; portal final desempilha E'
  };

  function montarLegendas() {
    var corpo = $('legenda-sigma');
    PDA.ALFABETO.forEach(function (s) {
      var tr = el('tr');
      tr.appendChild(el('td', 'versal', s));
      tr.appendChild(el('td', null, NO_MAPA[s]));
      tr.appendChild(el('td', null, EFEITO[s]));
      corpo.appendChild(tr);
    });
    var gama = $('legenda-gama');
    PDA.ALFABETO_PILHA.forEach(function (g) {
      var tr = el('tr');
      tr.appendChild(el('td', 'versal', g));
      tr.appendChild(el('td', null, PDA.SIGNIFICADO_PILHA[g]));
      gama.appendChild(tr);
    });
  }

  function montarDefinicao() {
    var dl = $('definicao');
    var linhas = [
      ['Q', '{ ' + PDA.ESTADOS.map(function (e) { return e.id; }).join(', ') + ' }: ' +
            PDA.ESTADOS.map(function (e) { return e.id + ' ' + e.sala; }).join(', ')],
      ['Σ', '{ ' + PDA.ALFABETO.join(', ') + ' }'],
      ['Γ', '{ ' + PDA.ALFABETO_PILHA.join(', ') + ' }'],
      ['δ', PDA.TRANSICOES.length + ' transições, na tabela abaixo'],
      ['q0', 'estado inicial (' + PDA.sala(PDA.ESTADO_INICIAL) + ')'],
      ['Z', 'símbolo inicial da pilha (mochila vazia)'],
      ['F', '{ ' + PDA.ESTADOS_FINAIS.join(', ') + ' }: ' + PDA.ESTADOS_FINAIS.map(PDA.sala).join(', ')]
    ];
    linhas.forEach(function (l) {
      dl.appendChild(el('dt', null, l[0]));
      dl.appendChild(el('dd', null, l[1]));
    });
  }

  var linhasDelta = {};
  function montarTabelaDelta() {
    var corpo = $('tabela-delta');
    PDA.TRANSICOES.forEach(function (t) {
      var tr = el('tr');
      tr.dataset.n = t.n;
      tr.appendChild(el('td', 'versal', String(t.n)));
      tr.appendChild(el('td', null, t.de + ' ' + PDA.sala(t.de)));
      tr.appendChild(el('td', null, t.para + ' ' + PDA.sala(t.para)));
      tr.appendChild(el('td', 'versal', PDA.rotulo(t)));
      tr.appendChild(el('td', 'versal', deltaFormal(t)));
      tr.appendChild(el('td', null, t.significado));
      tr.addEventListener('mouseenter', function () { isolar(t.n); });
      tr.addEventListener('mouseleave', function () { isolar(null); });
      corpo.appendChild(tr);
      linhasDelta[t.n] = tr;
    });
  }

  /* ---------------------------------------------------------
     2. Diagrama de estados (mesma disposição do .jff)
     --------------------------------------------------------- */

  var POS = { q0: [90, 330], q1: [320, 200], q2: [320, 460], q3: [550, 330], q4: [790, 330], q5: [1020, 330], q6: [1230, 330] };
  var R = 34;
  var arestas = {};   // "de|para" -> { g, textos: {n: text} }
  var nos = {};

  function montarDiagrama() {
    var d = $('diagrama');
    var defs = svg('defs');
    var marcador = svg('marker', { id: 'seta', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    marcador.appendChild(svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8a8076' }));
    defs.appendChild(marcador);
    var marcadorAceso = svg('marker', { id: 'seta-acesa', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    marcadorAceso.appendChild(svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#f08a2a' }));
    defs.appendChild(marcadorAceso);
    d.appendChild(defs);

    // seta de estado inicial
    d.appendChild(svg('path', { class: 'inicio', d: 'M 18 ' + POS.q0[1] + ' L ' + (POS.q0[0] - R - 2) + ' ' + POS.q0[1], 'marker-end': 'url(#seta)' }));

    // agrupa transições pelo par (de, para)
    var grupos = {};
    PDA.TRANSICOES.forEach(function (t) {
      var k = t.de + '|' + t.para;
      (grupos[k] = grupos[k] || []).push(t);
    });

    Object.keys(grupos).forEach(function (k) {
      var lista = grupos[k];
      var de = lista[0].de, para = lista[0].para;
      var g = svg('g', { class: 'aresta' });
      var a = POS[de], b = POS[para];
      var caminho, lx, ly, ancora = 'middle', acima = true;

      if (de === para) {
        // laço: acima do estado (abaixo para a Ala Leste, que fica embaixo)
        acima = de !== 'q2';
        var s = acima ? -1 : 1;
        caminho = 'M ' + (a[0] - 14) + ' ' + (a[1] + s * (R - 4)) +
                  ' C ' + (a[0] - 46) + ' ' + (a[1] + s * 110) + ', ' + (a[0] + 46) + ' ' + (a[1] + s * 110) + ', ' +
                  (a[0] + 14) + ' ' + (a[1] + s * (R - 2));
        lx = a[0]; ly = acima ? a[1] - 96 : a[1] + 108;
      } else {
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
        var ux = dx / len, uy = dy / len;
        var x1 = a[0] + ux * R, y1 = a[1] + uy * R, x2 = b[0] - ux * (R + 3), y2 = b[1] - uy * (R + 3);
        caminho = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
        lx = (x1 + x2) / 2; ly = (y1 + y2) / 2 - 12;
        if (Math.abs(dy) > 1) { ancora = dy * dx < 0 ? 'end' : 'start'; lx += dy * dx < 0 ? -10 : 10; ly += 4; }
      }
      g.appendChild(svg('path', { d: caminho, 'marker-end': 'url(#seta)' }));

      var textos = {};
      lista.forEach(function (t, i) {
        var y = de === para
          ? (acima ? ly - (lista.length - 1 - i) * 22 : ly + i * 22)
          : ly - (lista.length - 1 - i) * 22;
        var tx = svg('text', { x: lx, y: y, 'text-anchor': ancora }, PDA.rotulo(t));
        tx.dataset.n = t.n;
        tx.addEventListener('mouseenter', function () { isolar(t.n); });
        tx.addEventListener('mouseleave', function () { isolar(null); });
        g.appendChild(tx);
        textos[t.n] = tx;
      });
      d.appendChild(g);
      arestas[k] = { g: g, textos: textos, caminho: g.firstChild };
    });

    // estados por cima das arestas
    PDA.ESTADOS.forEach(function (e) {
      var p = POS[e.id];
      var g = svg('g', { class: 'no' });
      g.appendChild(svg('circle', { cx: p[0], cy: p[1], r: R }));
      if (PDA.ehFinal(e.id)) g.appendChild(svg('circle', { class: 'anel', cx: p[0], cy: p[1], r: R - 6, stroke: '#8a8076', 'stroke-width': 2 }));
      g.appendChild(svg('text', { x: p[0], y: p[1] + 7 }, e.id));
      var abaixo = e.id === 'q2' ? -R - 12 : R + 24;
      g.appendChild(svg('text', { class: 'sala', x: p[0], y: p[1] + abaixo }, e.sala));
      d.appendChild(g);
      nos[e.id] = g;
    });
  }

  // Passar o mouse numa regra acende só aquela transição (no diagrama e na tabela)
  function isolar(n) {
    var d = $('diagrama');
    Object.keys(arestas).forEach(function (k) {
      var a = arestas[k];
      var tem = n != null && a.textos[n];
      a.g.classList.toggle('foco', !!tem);
      Object.keys(a.textos).forEach(function (m) { a.textos[m].classList.toggle('foco', String(m) === String(n)); });
    });
    d.classList.toggle('isolando', n != null);
    Object.keys(linhasDelta).forEach(function (m) {
      linhasDelta[m].style.outline = String(m) === String(n) ? '1px solid rgba(240,138,42,0.6)' : '';
    });
  }

  /* ---------------------------------------------------------
     3. Placa: estado, símbolo, pilha, transição, veredito
     --------------------------------------------------------- */

  var pilhaAnterior = null;

  function desenharPilha(pilha) {
    var ol = $('p-pilha');
    var novos = pilha.split('').reverse();     // do fundo para o topo
    var velhos = pilhaAnterior == null ? novos : pilhaAnterior.split('').reverse();
    ol.textContent = '';

    // símbolos que saíram do topo sobem e somem
    for (var j = velhos.length - 1; j >= novos.length; j--) {
      var fantasma = nicho(velhos[j], false, false);
      fantasma.classList.add('sai');
      fantasma.setAttribute('aria-hidden', 'true');
      ol.appendChild(fantasma);
      setTimeout(function (f) { return function () { if (f.parentNode) f.parentNode.removeChild(f); }; }(fantasma), 450);
    }
    for (var i = novos.length - 1; i >= 0; i--) {
      var n = nicho(novos[i], i === novos.length - 1, i === 0);
      if (pilhaAnterior != null && velhos[i] !== novos[i]) n.classList.add('entra');
      ol.appendChild(n);
    }
    if (!novos.length) ol.appendChild(el('li', 'nicho__sentido', 'Pilha vazia'));
    pilhaAnterior = pilha;
  }

  // O objeto que cada símbolo da pilha representa, desenhado como no mapa:
  // a chave vai sendo montada (cabo, haste, dentes) por cima da estrela.
  // Gradientes de latão e da estrela, definidos uma vez para todos os nichos
  function montarMateriais() {
    var defs = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
    var d = svg('defs');
    var lat = svg('linearGradient', { id: 'mat-latao', x1: 0, y1: 0, x2: 0, y2: 1 });
    lat.appendChild(svg('stop', { offset: '0', 'stop-color': '#f0cd8a' }));
    lat.appendChild(svg('stop', { offset: '0.45', 'stop-color': '#b88b45' }));
    lat.appendChild(svg('stop', { offset: '1', 'stop-color': '#6e4a1e' }));
    var est = svg('radialGradient', { id: 'mat-estrela', cx: '0.42', cy: '0.38', r: '0.7' });
    est.appendChild(svg('stop', { offset: '0', 'stop-color': '#fff6dc' }));
    est.appendChild(svg('stop', { offset: '0.55', 'stop-color': '#e9cf8e' }));
    est.appendChild(svg('stop', { offset: '1', 'stop-color': '#9c7530' }));
    d.appendChild(lat); d.appendChild(est);
    defs.appendChild(d);
    document.body.appendChild(defs);
  }

  // O objeto que cada símbolo da pilha representa, desenhado como no mapa:
  // a chave vai sendo montada (cabo, haste, dentes) por cima da estrela.
  function objeto(simbolo) {
    if (['E', 'C', 'H', 'M'].indexOf(simbolo) === -1) return null;
    var s = svg('svg', { viewBox: '0 0 60 34', class: 'nicho__objeto', 'aria-hidden': 'true' });
    // sombra projetada no fundo do nicho
    s.appendChild(svg('ellipse', { cx: 30, cy: 29, rx: simbolo === 'E' ? 12 : 24, ry: 3.2, fill: 'rgba(0,0,0,0.7)' }));
    function latao(extra) {
      var o = { fill: 'url(#mat-latao)', stroke: '#2a1a0a', 'stroke-width': '1.6', 'stroke-linejoin': 'round' };
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    if (simbolo === 'E') {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 14 : 6;
        pts.push((30 + Math.cos(ang) * r).toFixed(1) + ',' + (15 + Math.sin(ang) * r).toFixed(1));
      }
      s.appendChild(svg('polygon', { points: pts.join(' '), fill: 'url(#mat-estrela)', stroke: '#5a3e14', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }));
      s.appendChild(svg('path', { d: 'M30 3 L32.5 11', stroke: 'rgba(255,255,240,0.8)', 'stroke-width': '1.2', fill: 'none' }));
      return s;
    }
    // cabo (argola)
    s.appendChild(svg('circle', latao({ cx: 13, cy: 15, r: 9 })));
    s.appendChild(svg('circle', { cx: 13, cy: 15, r: 3.6, fill: '#120f0e', stroke: '#2a1a0a', 'stroke-width': '1' }));
    // haste
    if (simbolo !== 'C') s.appendChild(svg('rect', latao({ x: 21, y: 12, width: simbolo === 'M' ? 33 : 21, height: 6, rx: 1.5 })));
    // dentes
    if (simbolo === 'M') {
      s.appendChild(svg('path', latao({ d: 'M41 17 h5 v6 h-5 z' })));
      s.appendChild(svg('path', latao({ d: 'M48 17 h5 v8 h-5 z' })));
    }
    // brilho no topo do metal
    s.appendChild(svg('path', { d: 'M6.5 10 A8 8 0 0 1 16.5 7', stroke: 'rgba(255,240,205,0.85)', 'stroke-width': '1.6', fill: 'none', 'stroke-linecap': 'round' }));
    if (simbolo !== 'C') s.appendChild(svg('path', { d: 'M23 13.4 H' + (simbolo === 'M' ? 52 : 40), stroke: 'rgba(255,240,205,0.6)', 'stroke-width': '1', fill: 'none' }));
    return s;
  }

  function nicho(simbolo, topo, fundo) {
    var li = el('li', 'nicho' + (topo ? ' nicho--topo' : '') + (fundo ? ' nicho--fundo' : ''));
    li.appendChild(el('span', 'nicho__letra', simbolo));
    var caixa = el('span', 'nicho__caixa');
    var obj = objeto(simbolo);
    if (obj) caixa.appendChild(obj);
    li.appendChild(caixa);
    li.appendChild(el('span', 'nicho__sentido', PDA.SIGNIFICADO_PILHA[simbolo] + (topo ? ' · topo' : '')));
    return li;
  }

  function desenharFita(ol, roteiro, ate, erroEm, animarUltimo) {
    ol.textContent = '';
    for (var i = 0; i < roteiro.length; i++) {
      var li = el('li', null, roteiro.charAt(i));
      li.title = PDA.ACOES[roteiro.charAt(i)] || 'Fora do alfabeto';
      if (i === erroEm) li.className = 'erro';
      else if (i === ate - 1) li.className = 'atual';
      else if (i < ate) li.className = 'lido';
      if (animarUltimo && i === roteiro.length - 1) li.classList.add('novo');
      ol.appendChild(li);
    }
  }

  /**
   * Mostra uma execução na página.
   *   exec:  resultado de PDA.executar(roteiro)
   *   pos:   qual configuração mostrar (0 = inicial ... exec.passos.length - 1)
   *   opcoes.emCurso: true no modo Explorar enquanto o jogo não acabou
   *   opcoes.fita:    elemento <ol> da fita a preencher
   */
  function render(exec, pos, opcoes) {
    opcoes = opcoes || {};
    var ultimo = exec.passos.length - 1;
    if (pos == null || pos > ultimo) pos = ultimo;
    var noFim = pos === ultimo;
    var passo = exec.passos[pos];
    var rejeitouAqui = noFim && exec.parouEm != null;

    // estado
    $('p-estado').textContent = passo.estado;
    $('p-sala').textContent = PDA.sala(passo.estado);
    $('p-estado').parentNode.classList.toggle('final', PDA.ehFinal(passo.estado));

    // símbolo processado
    var glifo = $('p-simbolo'), acao = $('p-acao');
    glifo.className = 'simbolo__glifo';
    if (rejeitouAqui) {
      glifo.textContent = exec.simboloRejeitado;
      glifo.classList.add('erro');
      acao.textContent = (PDA.ACOES[exec.simboloRejeitado] || 'Símbolo fora do alfabeto') + ': sem transição';
    } else if (passo.lido) {
      glifo.textContent = passo.lido;
      glifo.classList.add('ativo');
      acao.textContent = PDA.ACOES[passo.lido];
    } else {
      glifo.textContent = '–';
      acao.textContent = 'Nenhum símbolo lido ainda';
    }
    if (opcoes.animar) { void glifo.offsetWidth; glifo.classList.add('bate'); }

    // pilha
    desenharPilha(passo.pilha);

    // transição usada
    var regra = $('p-regra');
    regra.textContent = '';
    if (passo.transicao) {
      var t = passo.transicao;
      regra.appendChild(el('span', 'regra__formal', deltaFormal(t)));
      var j = el('span', null, 'Regra ' + t.n + ' · ');
      j.appendChild(el('span', 'regra__jflap', PDA.rotulo(t)));
      regra.appendChild(j);
      regra.appendChild(el('span', 'regra__sentido', t.significado));
    } else {
      regra.textContent = 'Nenhuma ainda. O autômato está na configuração inicial (q0, Z).';
    }

    // veredito
    var v = $('p-veredito');
    v.className = 'veredito';
    var titulo, texto, formal = '';
    if (opcoes.aguardando) {
      titulo = 'Aguardando roteiro';
      texto = 'Digite as letras ou escolha um exemplo. Vazio, o roteiro seria rejeitado.';
      formal = 'λ deixa o autômato em q0 ∉ F = { q6 }';
    } else if (noFim && exec.aceita) {
      v.classList.add('veredito--aceita');
      titulo = 'ACEITA'; texto = exec.motivo.texto; formal = exec.motivo.formal;
    } else if (rejeitouAqui || (noFim && !opcoes.emCurso)) {
      v.classList.add('veredito--rejeitada');
      titulo = 'REJEITADA'; texto = exec.motivo.texto; formal = exec.motivo.formal;
    } else if (opcoes.emCurso) {
      titulo = 'Em curso';
      texto = exec.roteiro.length
        ? 'Nenhuma regra foi quebrada até aqui. Ainda falta chegar ao portal final.'
        : 'Explore a masmorra: cada interação vira um passo do autômato.';
    } else {
      titulo = 'Em curso';
      texto = 'Lidos ' + pos + ' de ' + exec.roteiro.length + ' símbolos.';
    }
    $('p-veredito-titulo').textContent = titulo;
    $('p-veredito-texto').textContent = texto;
    $('p-veredito-formal').textContent = formal;

    // fita
    if (opcoes.fita) desenharFita(opcoes.fita, exec.roteiro, pos, rejeitouAqui ? exec.parouEm : null, opcoes.animar);

    // tabela δ e diagrama: regra usada e estados visitados
    Object.keys(linhasDelta).forEach(function (n) {
      linhasDelta[n].classList.toggle('usada', !!passo.transicao && String(passo.transicao.n) === n);
    });
    var visitados = {};
    for (var i = 0; i <= pos; i++) visitados[exec.passos[i].estado] = true;
    Object.keys(nos).forEach(function (q) {
      nos[q].classList.toggle('atual', q === passo.estado);
      nos[q].classList.toggle('visitado', !!visitados[q] && q !== passo.estado);
    });
    Object.keys(arestas).forEach(function (k) {
      var a = arestas[k];
      var usada = !!passo.transicao && (passo.transicao.de + '|' + passo.transicao.para) === k;
      a.g.classList.toggle('usada', usada);
      a.caminho.setAttribute('marker-end', usada ? 'url(#seta-acesa)' : 'url(#seta)');
      Object.keys(a.textos).forEach(function (n) {
        a.textos[n].classList.toggle('usada', usada && String(passo.transicao.n) === n);
      });
    });

    desenharRastreio(exec, pos, opcoes.emCurso);
    return visitados;
  }

  function desenharRastreio(exec, pos, emCurso) {
    var corpo = $('rastreio');
    corpo.textContent = '';
    exec.passos.forEach(function (p, i) {
      var tr = el('tr');
      if (i === pos) tr.className = 'atual';
      else if (i > pos) tr.className = 'futuro';
      tr.appendChild(el('td', 'versal', String(p.passo)));
      tr.appendChild(el('td', 'versal', p.estado));
      tr.appendChild(el('td', null, PDA.sala(p.estado)));
      tr.appendChild(el('td', 'versal', p.lido || '–'));
      tr.appendChild(el('td', 'versal', p.pilha));
      tr.appendChild(el('td', null, p.transicao ? p.transicao.n + ': ' + PDA.rotulo(p.transicao) : '–'));
      corpo.appendChild(tr);
    });
    var ultimo = exec.passos.length - 1;
    if (pos === ultimo && exec.roteiro.length && (exec.parouEm != null || exec.aceita || !emCurso)) {
      var fim = el('tr', exec.aceita ? 'aceite' : 'rejeicao');
      var td = el('td', null, (exec.aceita ? 'ACEITA: ' : 'REJEITADA: ') + exec.motivo.formal);
      td.colSpan = 6;
      fim.appendChild(td);
      corpo.appendChild(fim);
    }
  }

  // Posição, na tela, do nicho do topo da pilha (destino da peça que voa do mapa)
  function pontoDoTopo() {
    var topo = document.querySelector('#p-pilha .nicho--topo .nicho__letra');
    if (!topo) return null;
    var r = topo.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function montar() {
    montarMateriais();
    montarLegendas();
    montarDefinicao();
    montarTabelaDelta();
    montarDiagrama();
    var img = $('img-jflap');
    img.addEventListener('error', function () { img.parentNode.classList.add('faltando'); });
  }

  raiz.Painel = { montar: montar, render: render, pontoDoTopo: pontoDoTopo, reiniciarPilha: function () { pilhaAnterior = null; } };
})(window);
