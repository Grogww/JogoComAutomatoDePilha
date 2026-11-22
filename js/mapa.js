/* ===========================================================
   A Masmorra da Chave Partida — mapa e modo WASD

   Este arquivo desenha a masmorra no <canvas> e move o aventureiro.
   Ele NÃO decide nada sobre o autômato: quando o aventureiro encosta
   num objeto, o mapa pergunta ao motor (via callback aoInteragir) se o
   símbolo correspondente tem transição. Só então o objeto reage:
     - estrela (*), pedaço (a): some do chão;
     - corredor e grades (s): o aventureiro passa e a grade fecha atrás;
     - portal azul e portal final (c): teletransporta;
     - porta (b): abre.
   Andar sobre o chão não gera símbolo nenhum.

   O mapa é uma grade de 44 × 26 ladrilhos. Cada ladrilho de chão
   pertence a uma sala, e cada sala é um estado do autômato.
   =========================================================== */
(function (raiz) {
  'use strict';

  var T = 24;                 // tamanho do ladrilho, em pixels do canvas
  var COLS = 44, LINHAS = 26;
  var LARG = COLS * T, ALT = LINHAS * T;

  var VAZIO = 0, PAREDE = 1, CHAO = 2;

  /* ---------------------------------------------------------
     1. Planta da masmorra
     Interiores das salas (x, y, largura, altura em ladrilhos).
     Salas vizinhas dividem a mesma parede.
     --------------------------------------------------------- */

  var SALAS = {
    q0: { x: 15, y: 16, w: 13, h: 9 },   // Entrada
    q1: { x: 2,  y: 8,  w: 10, h: 10 },  // Ala Oeste
    q2: { x: 31, y: 8,  w: 11, h: 10 },  // Ala Leste
    q3: { x: 13, y: 8,  w: 17, h: 7 },   // Galeria Central
    q4: { x: 15, y: 1,  w: 10, h: 6 },   // Salão da Porta
    q5: { x: 26, y: 1,  w: 10, h: 6 }    // Câmara do Portal
  };

  // Corredor que liga a Entrada à Ala Oeste (pertence à Ala Oeste: q1)
  var CORREDOR = [];
  (function () {
    for (var x = 6; x <= 13; x++) CORREDOR.push([x, 21]);
    CORREDOR.push([6, 20], [6, 19], [6, 18]);
  })();

  // Ponto onde o aventureiro aparece em cada sala (usado no modo Roteiro)
  var CENTRO = { q0: [21, 22], q1: [7, 12], q2: [36, 12], q3: [21, 11], q4: [20, 4], q5: [30, 4], q6: [33, 3] };

  // Passagens: ficam na linha da parede; atravessar gera o símbolo indicado
  // e leva o aventureiro ao ladrilho "destino" do outro lado.
  var PASSAGENS = [
    { id: 'corredor', x: 14, y: 21, simbolo: 's', destino: [13, 21], orient: 'v', selada: true },
    { id: 'grade-oeste', x: 12, y: 11, simbolo: 's', destino: [13, 11], orient: 'v' },
    { id: 'grade-leste', x: 30, y: 11, simbolo: 's', destino: [29, 11], orient: 'v' },
    { id: 'grade-salao', x: 19, y: 7, simbolo: 's', destino: [19, 6], orient: 'h' },
    { id: 'porta', x: 25, y: 3, simbolo: 'b', destino: [26, 3], orient: 'v', porta: true }
  ];

  var PORTAIS = [
    { id: 'portal-azul', x: 26, y: 18, simbolo: 'c', destino: [36, 15], cor: 'azul' },
    { id: 'portal-final', x: 33, y: 3, simbolo: 'c', destino: null, cor: 'fogo' }
  ];

  var ITENS_INICIAIS = [
    { tipo: 'estrela', x: 21, y: 19 },
    { tipo: 'pedaco', x: 4, y: 10 },  { tipo: 'pedaco', x: 9, y: 15 },     // Ala Oeste
    { tipo: 'pedaco', x: 34, y: 10 }, { tipo: 'pedaco', x: 39, y: 15 },    // Ala Leste
    { tipo: 'pedaco', x: 16, y: 10 }, { tipo: 'pedaco', x: 26, y: 13 }     // Galeria Central
  ];

  // Arandelas com tochas, presas nas paredes (cada uma ilumina sua sala)
  var ARANDELAS = [
    { x: 18, y: 15, sala: 'q0' }, { x: 24, y: 15, sala: 'q0' },
    { x: 4, y: 7, sala: 'q1' },   { x: 9, y: 7, sala: 'q1' },
    { x: 33, y: 7, sala: 'q2' },  { x: 39, y: 7, sala: 'q2' },
    { x: 14, y: 7, sala: 'q3' },  { x: 28, y: 7, sala: 'q3' },
    { x: 17, y: 0, sala: 'q4' },  { x: 22, y: 0, sala: 'q4' },
    { x: 29, y: 0, sala: 'q5' },  { x: 33, y: 0, sala: 'q5' }
  ];

  var INICIO = [21, 23];

  // Grade de ladrilhos e sala de cada ladrilho
  var grade = [], salaDe = [];
  function construirGrade() {
    var x, y, k;
    for (y = 0; y < LINHAS; y++) { grade[y] = []; salaDe[y] = []; for (x = 0; x < COLS; x++) { grade[y][x] = VAZIO; salaDe[y][x] = null; } }
    for (k in SALAS) {
      var s = SALAS[k];
      for (y = s.y; y < s.y + s.h; y++) for (x = s.x; x < s.x + s.w; x++) { grade[y][x] = CHAO; salaDe[y][x] = k; }
    }
    CORREDOR.forEach(function (p) { grade[p[1]][p[0]] = CHAO; salaDe[p[1]][p[0]] = 'q1'; });
    // paredes: todo vazio vizinho (8 direções) de um chão
    for (y = 0; y < LINHAS; y++) for (x = 0; x < COLS; x++) {
      if (grade[y][x] !== VAZIO) continue;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < LINHAS && xx >= 0 && xx < COLS && grade[yy][xx] === CHAO) grade[y][x] = PAREDE;
      }
    }
  }

  /* ---------------------------------------------------------
     2. Estado do jogo no mapa
     --------------------------------------------------------- */

  var canvas, ctx, base, luz, lctx, dpr = 1;
  var reduzido = false;
  var callbacks = {};

  var jogo;          // estado do modo Explorar
  var vitrine = null; // estado mostrado no modo Roteiro (ou null)

  function novoJogo() {
    return {
      x: INICIO[0], y: INICIO[1],
      px: INICIO[0] * T, py: INICIO[1] * T,   // posição desenhada (anima entre ladrilhos)
      anim: null,
      itens: ITENS_INICIAIS.map(function (i) { return { tipo: i.tipo, x: i.x, y: i.y, ativo: true }; }),
      fechadas: {},      // passagens que já fecharam atrás do aventureiro
      abertas: {},       // porta aberta
      portalApagado: false,
      corredorFechado: false,
      salaAtual: 'q0',
      visitadas: { q0: true },
      encerrado: false,
      olhando: 1,        // 1 direita, -1 esquerda
      quebra: null,      // efeito de partícula quando rejeita
      pendente: null     // próximo passo pedido durante uma animação
    };
  }

  /* ---------------------------------------------------------
     3. Desenho da pedra (camada fixa, desenhada uma vez)
     --------------------------------------------------------- */

  // gerador pseudoaleatório com semente, para a pedra ser sempre igual
  function semente(n) { return function () { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; }; }

  function desenharBase() {
    base = document.createElement('canvas');
    base.width = LARG * dpr; base.height = ALT * dpr;
    var b = base.getContext('2d');
    b.scale(dpr, dpr);
    var rnd = semente(1337);

    b.fillStyle = '#060505';
    b.fillRect(0, 0, LARG, ALT);

    for (var y = 0; y < LINHAS; y++) for (var x = 0; x < COLS; x++) {
      var t = grade[y][x], px = x * T, py = y * T;
      if (t === CHAO) {
        var v = 34 + Math.floor(rnd() * 10);
        b.fillStyle = 'rgb(' + (v + 4) + ',' + (v + 1) + ',' + v + ')';
        b.fillRect(px, py, T, T);
        // lajes: juntas escuras e um leve relevo
        b.fillStyle = 'rgba(0,0,0,0.35)';
        b.fillRect(px, py + T - 1, T, 1);
        b.fillRect(px + T - 1, py, 1, T);
        b.fillStyle = 'rgba(255,240,220,0.035)';
        b.fillRect(px, py, T, 1);
        if (rnd() < 0.18) { // rachaduras e manchas
          b.strokeStyle = 'rgba(0,0,0,0.4)';
          b.lineWidth = 1;
          b.beginPath();
          b.moveTo(px + rnd() * T, py + rnd() * T);
          b.lineTo(px + rnd() * T, py + rnd() * T);
          b.stroke();
        }
      } else if (t === PAREDE) {
        var abaixo = y + 1 < LINHAS ? grade[y + 1][x] : VAZIO;
        var g = 52 + Math.floor(rnd() * 12);
        b.fillStyle = 'rgb(' + (g + 6) + ',' + (g + 2) + ',' + g + ')';
        b.fillRect(px, py, T, T);
        // blocos de pedra
        b.fillStyle = 'rgba(0,0,0,0.45)';
        b.fillRect(px, py + T / 2 - 1, T, 2);
        b.fillRect(px + ((y % 2) ? T / 2 : 0), py, 2, T / 2);
        b.fillRect(px + ((y % 2) ? 0 : T / 2), py + T / 2, 2, T / 2);
        b.fillStyle = 'rgba(255,235,210,0.06)';
        b.fillRect(px, py, T, 2);
        if (abaixo === CHAO) { // face da parede voltada para a sala
          var grad = b.createLinearGradient(0, py + T * 0.45, 0, py + T);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.65)');
          b.fillStyle = grad;
          b.fillRect(px, py + T * 0.45, T, T * 0.55);
        }
      }
    }

    // sombra das paredes projetada no chão
    for (y = 1; y < LINHAS; y++) for (x = 0; x < COLS; x++) {
      if (grade[y][x] === CHAO && grade[y - 1][x] === PAREDE) {
        var sg = b.createLinearGradient(0, y * T, 0, y * T + T * 0.7);
        sg.addColorStop(0, 'rgba(0,0,0,0.55)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = sg;
        b.fillRect(x * T, y * T, T, T * 0.7);
      }
    }

    // arandelas (suporte de ferro)
    ARANDELAS.forEach(function (a) {
      var cx = a.x * T + T / 2, cy = a.y * T + T / 2;
      b.fillStyle = '#1a1716';
      b.fillRect(cx - 3, cy - 2, 6, 10);
      b.fillStyle = '#4a3f36';
      b.beginPath();
      b.moveTo(cx - 6, cy - 3); b.lineTo(cx + 6, cy - 3); b.lineTo(cx + 3, cy + 2); b.lineTo(cx - 3, cy + 2);
      b.closePath(); b.fill();
    });
  }

  /* ---------------------------------------------------------
     4. Desenho dos objetos (a cada quadro)
     --------------------------------------------------------- */

  function desenharEstrela(c, cx, cy, r, tempo) {
    var pulso = reduzido ? 1 : 1 + Math.sin(tempo / 300) * 0.06;
    c.save();
    c.translate(cx, cy);
    c.scale(pulso, pulso);
    c.shadowColor = 'rgba(255, 210, 140, 0.9)';
    c.shadowBlur = 14;
    c.fillStyle = '#f1dca6';
    c.strokeStyle = '#6b4a1c';
    c.lineWidth = 1.5;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.45;
      c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.stroke();
    c.restore();
  }

  // pedaço de chave: um fragmento de bronze com dente
  function desenharPedaco(c, cx, cy) {
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.5);
    c.fillStyle = '#b0884a';
    c.strokeStyle = '#3a2710';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(-5, 0, 5, 0, Math.PI * 2);
    c.fill(); c.stroke();
    c.fillStyle = '#1b1514';
    c.beginPath(); c.arc(-5, 0, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b0884a';
    c.beginPath();
    c.rect(0, -2, 11, 4);
    c.rect(7, 2, 3, 3);
    c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,230,180,0.5)';
    c.fillRect(1, -2, 9, 1);
    c.restore();
  }

  function desenharGrade(c, p, fechada) {
    var px = p.x * T, py = p.y * T;
    c.fillStyle = fechada ? '#0b0a0a' : '#151212';
    c.fillRect(px, py, T, T);
    c.strokeStyle = fechada ? '#5b3a2c' : '#55524f';
    c.lineWidth = 2;
    c.beginPath();
    var n = fechada ? 5 : 3;
    for (var i = 1; i <= n; i++) {
      var d = (T / (n + 1)) * i;
      if (p.orient === 'v') { c.moveTo(px + 2, py + d); c.lineTo(px + T - 2, py + d); }
      else { c.moveTo(px + d, py + 2); c.lineTo(px + d, py + T - 2); }
    }
    if (p.orient === 'v') { c.moveTo(px + T / 2, py); c.lineTo(px + T / 2, py + T); }
    else { c.moveTo(px, py + T / 2); c.lineTo(px + T, py + T / 2); }
    c.stroke();
    // selo da estrela no corredor (só abre com a estrela)
    if (p.selada && !fechada) desenharEstrela(c, px + T / 2, py + T / 2, 5, 0);
  }

  function desenharPorta(c, p, aberta) {
    var px = p.x * T, py = p.y * T;
    if (aberta) {
      c.fillStyle = '#2a2523';
      c.fillRect(px, py, T, T);
      c.fillStyle = '#4a3322';
      c.fillRect(px + T - 5, py - 2, 5, T + 4); // folha da porta encostada
      return;
    }
    c.fillStyle = '#4a3322';
    c.fillRect(px + 1, py - 4, T - 2, T + 8);
    c.strokeStyle = '#2a1b10';
    c.lineWidth = 1;
    for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(px + 1 + i * (T - 2) / 4, py - 4); c.lineTo(px + 1 + i * (T - 2) / 4, py + T + 4); c.stroke(); }
    c.fillStyle = '#2b2b2e';
    c.fillRect(px + 1, py, T - 2, 3);
    c.fillRect(px + 1, py + T - 4, T - 2, 3);
    // fechadura
    c.fillStyle = '#c9a25a';
    c.beginPath(); c.arc(px + T / 2, py + T / 2 - 1, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0d0909';
    c.beginPath(); c.arc(px + T / 2, py + T / 2 - 1, 1.4, 0, Math.PI * 2); c.fill();
    c.fillRect(px + T / 2 - 0.8, py + T / 2, 1.6, 3.5);
  }

  function desenharPortal(c, p, tempo, apagado) {
    var cx = p.x * T + T / 2, cy = p.y * T + T / 2;
    var r = T * 0.62;
    c.save();
    if (apagado) {
      c.strokeStyle = '#3d3835';
      c.lineWidth = 4;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      c.restore();
      return;
    }
    var cor1 = p.cor === 'azul' ? 'rgba(160, 190, 215, 0.95)' : 'rgba(255, 214, 150, 0.98)';
    var cor2 = p.cor === 'azul' ? 'rgba(70, 100, 130, 0.0)' : 'rgba(240, 138, 42, 0.0)';
    var g = c.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, cor1);
    g.addColorStop(1, cor2);
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    // espiral girando
    c.strokeStyle = p.cor === 'azul' ? 'rgba(210, 228, 240, 0.8)' : 'rgba(255, 240, 210, 0.85)';
    c.lineWidth = 1.6;
    var giro = reduzido ? 0 : tempo / 520;
    for (var k = 0; k < 3; k++) {
      c.beginPath();
      for (var a = 0; a < Math.PI * 1.6; a += 0.12) {
        var rr = 2 + a * (r - 4) / (Math.PI * 1.6);
        var ang = a + giro + k * (Math.PI * 2 / 3);
        c.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      c.stroke();
    }
    c.strokeStyle = p.cor === 'azul' ? '#5b7a99' : '#c96a1c';
    c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  // O aventureiro: vulto encapuzado segurando a tocha
  function desenharAventureiro(c, x, y, tempo, olhando) {
    var cx = x + T / 2, cy = y + T / 2;
    c.save();
    // sombra no chão
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.beginPath(); c.ellipse(cx, cy + 9, 9, 3.5, 0, 0, Math.PI * 2); c.fill();
    // capa
    c.fillStyle = '#1d1b1d';
    c.strokeStyle = '#090808';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(cx, cy - 11);
    c.quadraticCurveTo(cx + 9, cy - 4, cx + 8, cy + 9);
    c.lineTo(cx - 8, cy + 9);
    c.quadraticCurveTo(cx - 9, cy - 4, cx, cy - 11);
    c.fill(); c.stroke();
    // luz da tocha batendo na borda da capa
    c.strokeStyle = 'rgba(255, 180, 100, 0.75)';
    c.lineWidth = 1.4;
    c.beginPath();
    if (olhando > 0) { c.moveTo(cx + 1, cy - 10); c.quadraticCurveTo(cx + 8.5, cy - 3, cx + 7.5, cy + 8); }
    else { c.moveTo(cx - 1, cy - 10); c.quadraticCurveTo(cx - 8.5, cy - 3, cx - 7.5, cy + 8); }
    c.stroke();
    // rosto no escuro do capuz
    c.fillStyle = '#0b0a0b';
    c.beginPath(); c.ellipse(cx + olhando * 1.5, cy - 4, 3.4, 4, 0, 0, Math.PI * 2); c.fill();
    // tocha
    var tx = cx + olhando * 9, ty = cy - 4;
    c.strokeStyle = '#5a3c22';
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(cx + olhando * 5, cy + 4); c.lineTo(tx, ty); c.stroke();
    var tremor = reduzido ? 0 : Math.sin(tempo / 70) * 1.2 + Math.sin(tempo / 37) * 0.7;
    var chama = c.createRadialGradient(tx, ty - 4, 0.5, tx, ty - 3, 7);
    chama.addColorStop(0, 'rgba(255, 245, 210, 1)');
    chama.addColorStop(0.35, 'rgba(255, 190, 90, 0.95)');
    chama.addColorStop(1, 'rgba(240, 110, 30, 0)');
    c.fillStyle = chama;
    c.beginPath();
    c.moveTo(tx - 4, ty);
    c.quadraticCurveTo(tx - 3, ty - 7 - tremor, tx + tremor * 0.4, ty - 11 - tremor);
    c.quadraticCurveTo(tx + 3, ty - 7 + tremor * 0.5, tx + 4, ty);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* ---------------------------------------------------------
     5. Luz: escuridão total, recortada pela tocha e pelas arandelas
     --------------------------------------------------------- */

  function furarLuz(c, x, y, raio, forca) {
    var g = c.createRadialGradient(x, y, raio * 0.15, x, y, raio);
    g.addColorStop(0, 'rgba(0,0,0,' + forca + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + (forca * 0.7) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, raio, 0, Math.PI * 2); c.fill();
  }

  // calor da chama: âmbar no centro, brasa no meio, some na pedra cinza
  function aquecer(c, x, y, raio, forca) {
    var g = c.createRadialGradient(x, y, 0, x, y, raio);
    g.addColorStop(0, 'rgba(240, 138, 42,' + forca + ')');
    g.addColorStop(0.45, 'rgba(180, 83, 28,' + (forca * 0.45) + ')');
    g.addColorStop(1, 'rgba(180, 83, 28, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, raio, 0, Math.PI * 2); c.fill();
  }

  function retanguloDaSala(k) {
    var s = SALAS[k];
    return { x: (s.x - 1) * T, y: (s.y - 1) * T, w: (s.w + 2) * T, h: (s.h + 2) * T };
  }

  function desenharLuz(tempo, cena) {
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = 'rgba(4, 3, 3, 0.975)';
    lctx.fillRect(0, 0, LARG, ALT);
    lctx.globalCompositeOperation = 'destination-out';

    // salas já visitadas: brasa fraca (dá para ver onde se esteve)
    for (var k in cena.visitadas) {
      if (k === cena.sala || !SALAS[k]) continue;
      var r = retanguloDaSala(k);
      lctx.fillStyle = 'rgba(0,0,0,0.32)';
      lctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (cena.visitadas.q1 && cena.sala !== 'q1') { // o corredor também conta como Ala Oeste
      lctx.fillStyle = 'rgba(0,0,0,0.32)';
      CORREDOR.forEach(function (p) { lctx.fillRect((p[0] - 1) * T, (p[1] - 1) * T, T * 3, T * 3); });
    }

    var tremor = reduzido ? 0 : Math.sin(tempo / 90) * 4 + Math.sin(tempo / 41) * 2.5;

    // arandelas da sala atual
    ARANDELAS.forEach(function (a) {
      if (a.sala !== cena.sala) return;
      furarLuz(lctx, a.x * T + T / 2, a.y * T + T, T * 5.2 + tremor * 0.6, 0.85);
    });

    // tocha do aventureiro
    furarLuz(lctx, cena.hx + T / 2, cena.hy + T / 2, T * 5.6 + tremor, 1);

    // portais acesos emitem a própria luz; pedaços e estrela cintilam de leve
    cena.portais.forEach(function (p) { if (!p.apagado) furarLuz(lctx, p.x * T + T / 2, p.y * T + T / 2, T * 2.2, 0.9); });
    cena.itens.forEach(function (i) { if (i.ativo) furarLuz(lctx, i.x * T + T / 2, i.y * T + T / 2, T * (i.tipo === 'estrela' ? 1.8 : 0.9), i.tipo === 'estrela' ? 0.85 : 0.45); });

    ctx.drawImage(luz, 0, 0, LARG, ALT);

    // calor alaranjado da chama sobre o que está iluminado
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // salas já visitadas guardam uma brasa fraca
    for (var kv in cena.visitadas) {
      if (kv === cena.sala || !SALAS[kv]) continue;
      var rv = retanguloDaSala(kv);
      ctx.fillStyle = 'rgba(180, 83, 28, 0.075)';
      ctx.fillRect(rv.x + T, rv.y + T, rv.w - 2 * T, rv.h - 2 * T);
    }
    aquecer(ctx, cena.hx + T / 2, cena.hy + T / 2, T * 5.2 + tremor * 0.5, 0.34);
    ARANDELAS.forEach(function (a) {
      var acesa = a.sala === cena.sala;
      var brasa = cena.visitadas[a.sala];
      if (!acesa && !brasa) return;
      var ax = a.x * T + T / 2, ay = a.y * T + T / 2;
      aquecer(ctx, ax, ay + T * 0.8, T * (acesa ? 4.2 : 1.4), acesa ? 0.3 : 0.12);
      // a chama da arandela
      var t2 = reduzido ? 0 : Math.sin(tempo / 60 + a.x) * 1.5;
      var f = ctx.createRadialGradient(ax, ay - 6, 0, ax, ay - 5, 8);
      f.addColorStop(0, acesa ? 'rgba(255,240,200,1)' : 'rgba(255,150,80,0.6)');
      f.addColorStop(1, 'rgba(240,110,30,0)');
      ctx.fillStyle = f;
      ctx.beginPath(); ctx.ellipse(ax, ay - 6 - t2 * 0.3, 5, 8 + t2 * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // vinheta: as bordas do quadro somem no preto
    var v = ctx.createRadialGradient(LARG / 2, ALT / 2, ALT * 0.35, LARG / 2, ALT / 2, LARG * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, LARG, ALT);
  }

  /* ---------------------------------------------------------
     6. Quadro (render loop)
     --------------------------------------------------------- */

  function cenaAtual() {
    if (vitrine) {
      var c = CENTRO[vitrine.estado] || CENTRO.q0;
      return {
        hx: c[0] * T, hy: c[1] * T, olhando: 1,
        sala: vitrine.estado === 'q6' ? 'q5' : vitrine.estado,
        visitadas: vitrine.visitadas,
        itens: ITENS_INICIAIS.map(function (i) { return { tipo: i.tipo, x: i.x, y: i.y, ativo: true }; }),
        portais: PORTAIS.map(function (p) { return { x: p.x, y: p.y, cor: p.cor, id: p.id, apagado: false }; }),
        fechadas: {}, abertas: {}, oculto: vitrine.estado === 'q6'
      };
    }
    return {
      hx: jogo.px, hy: jogo.py, olhando: jogo.olhando,
      sala: jogo.salaAtual, visitadas: jogo.visitadas, itens: jogo.itens,
      portais: PORTAIS.map(function (p) {
        return { x: p.x, y: p.y, cor: p.cor, id: p.id, apagado: p.id === 'portal-azul' && jogo.portalApagado };
      }),
      fechadas: jogo.fechadas, abertas: jogo.abertas, oculto: jogo.encerrado === 'aceita'
    };
  }

  function quadro(tempo) {
    if (jogo.anim) avancarAnimacao(tempo);

    var cena = cenaAtual();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(base, 0, 0, LARG, ALT);

    PASSAGENS.forEach(function (p) {
      if (p.porta) desenharPorta(ctx, p, !!cena.abertas[p.id]);
      else desenharGrade(ctx, p, !!cena.fechadas[p.id]);
    });
    cena.portais.forEach(function (p) { desenharPortal(ctx, p, tempo, p.apagado); });
    cena.itens.forEach(function (i) {
      if (!i.ativo) return;
      if (i.tipo === 'estrela') desenharEstrela(ctx, i.x * T + T / 2, i.y * T + T / 2, 8, tempo);
      else desenharPedaco(ctx, i.x * T + T / 2, i.y * T + T / 2);
    });
    if (!cena.oculto) desenharAventureiro(ctx, cena.hx, cena.hy, tempo, cena.olhando);
    desenharQuebra(tempo);

    desenharLuz(tempo, cena);
    raiz.requestAnimationFrame(quadro);
  }

  // estilhaços quando o autômato rejeita (o 4º pedaço quebra a chave etc.)
  function desenharQuebra(tempo) {
    var q = jogo.quebra;
    if (!q) return;
    var t = (tempo - q.inicio) / 900;
    if (t > 1) { jogo.quebra = null; return; }
    ctx.save();
    q.lascas.forEach(function (l) {
      ctx.fillStyle = 'rgba(212, 102, 74,' + (1 - t) + ')';
      ctx.fillRect(q.x + l.vx * t * 40, q.y + l.vy * t * 40 + t * t * 20, 3, 3);
    });
    ctx.restore();
  }

  /* ---------------------------------------------------------
     7. Movimento e interação (modo Explorar)
     --------------------------------------------------------- */

  function solido(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= LINHAS) return true;
    return grade[y][x] !== CHAO;
  }

  function passagemEm(x, y) {
    for (var i = 0; i < PASSAGENS.length; i++) if (PASSAGENS[i].x === x && PASSAGENS[i].y === y) return PASSAGENS[i];
    return null;
  }
  function portalEm(x, y) {
    for (var i = 0; i < PORTAIS.length; i++) if (PORTAIS[i].x === x && PORTAIS[i].y === y) return PORTAIS[i];
    return null;
  }
  function itemEm(x, y) {
    for (var i = 0; i < jogo.itens.length; i++) { var it = jogo.itens[i]; if (it.ativo && it.x === x && it.y === y) return it; }
    return null;
  }

  function animarPara(x, y, duracao, depois) {
    if (reduzido) duracao = 0;
    jogo.anim = { de: [jogo.px, jogo.py], para: [x * T, y * T], inicio: null, duracao: duracao, depois: depois };
    jogo.x = x; jogo.y = y;
  }

  function avancarAnimacao(tempo) {
    var a = jogo.anim;
    if (a.inicio === null) a.inicio = tempo;
    var t = a.duracao ? Math.min(1, (tempo - a.inicio) / a.duracao) : 1;
    var e = 1 - Math.pow(1 - t, 3);
    jogo.px = a.de[0] + (a.para[0] - a.de[0]) * e;
    jogo.py = a.de[1] + (a.para[1] - a.de[1]) * e;
    if (t >= 1) {
      jogo.anim = null;
      if (a.depois) a.depois();
      // tecla apertada durante a animação: executa agora (nenhum toque se perde)
      if (!jogo.anim && jogo.pendente) {
        var p = jogo.pendente;
        jogo.pendente = null;
        mover(p[0], p[1]);
      }
    }
  }

  function entrarNaSala(k) {
    if (!k || k === jogo.salaAtual) return;
    jogo.salaAtual = k;
    jogo.visitadas[k] = true;
  }

  // O aventureiro tenta dar um passo. Retorna true se tentou algo.
  function mover(dx, dy) {
    if (vitrine || jogo.encerrado) return false;
    if (jogo.anim) { jogo.pendente = [dx, dy]; return true; }
    if (dx) jogo.olhando = dx;
    var nx = jogo.x + dx, ny = jogo.y + dy;
    if (callbacks.aoAndar) callbacks.aoAndar();

    // 1) passagens: corredor, grades e porta
    var p = passagemEm(nx, ny);
    if (p) {
      if (jogo.fechadas[p.id] || jogo.abertas[p.id] === 'atravessada') return false;
      var r = callbacks.aoInteragir(p.simbolo, { x: nx, y: ny, objeto: p.porta ? 'porta' : 'passagem' });
      if (!r.ok) { rejeitar(nx, ny); return true; }
      if (p.porta) jogo.abertas[p.id] = true;
      animarPara(nx, ny, 140, function () {
        animarPara(p.destino[0], p.destino[1], 160, function () {
          jogo.fechadas[p.id] = true;                       // a grade (ou a porta) não deixa voltar
          if (p.id === 'corredor') jogo.portalApagado = true; // o outro caminho se perde
          if (p.id === 'grade-oeste' || p.id === 'grade-leste') { // na Galeria, as duas alas ficam para trás
            jogo.fechadas['grade-oeste'] = true;
            jogo.fechadas['grade-leste'] = true;
          }
          entrarNaSala(salaDe[p.destino[1]][p.destino[0]]);
          if (callbacks.aoMudarSala) callbacks.aoMudarSala(jogo.salaAtual);
        });
      });
      return true;
    }

    // 2) portais
    var portal = portalEm(nx, ny);
    if (portal) {
      if (portal.id === 'portal-azul' && jogo.portalApagado) return false;
      var rp = callbacks.aoInteragir(portal.simbolo, { x: nx, y: ny, objeto: 'portal' });
      if (!rp.ok) { rejeitar(nx, ny); return true; }
      animarPara(nx, ny, 160, function () {
        if (portal.destino) {
          jogo.corredorFechado = true;
          jogo.fechadas.corredor = true;         // quem entra no portal azul perde o corredor
          jogo.px = portal.destino[0] * T; jogo.py = portal.destino[1] * T;
          jogo.x = portal.destino[0]; jogo.y = portal.destino[1];
          entrarNaSala(salaDe[jogo.y][jogo.x]);
          if (callbacks.aoMudarSala) callbacks.aoMudarSala(jogo.salaAtual);
        } else {
          jogo.encerrado = 'aceita';             // portal final: Liberdade
          if (callbacks.aoMudarSala) callbacks.aoMudarSala('q6');
        }
      });
      return true;
    }

    if (solido(nx, ny)) return false;

    // 3) itens no chão
    var item = itemEm(nx, ny);
    if (item) {
      var ri = callbacks.aoInteragir(item.tipo === 'estrela' ? '*' : 'a', { x: nx, y: ny, objeto: item.tipo });
      if (!ri.ok) { rejeitar(nx, ny); return true; }
      item.ativo = false;
      animarPara(nx, ny, 120, null);
      return true;
    }

    // 4) chão livre: só anda, nenhum símbolo
    animarPara(nx, ny, 115, function () { entrarNaSala(salaDe[ny][nx]); });
    return true;
  }

  function rejeitar(x, y) {
    jogo.encerrado = 'rejeitada';
    var lascas = [];
    for (var i = 0; i < 18; i++) lascas.push({ vx: Math.cos(i) * (0.4 + (i % 5) / 5), vy: Math.sin(i * 1.7) * (0.4 + (i % 3) / 3) - 0.6 });
    jogo.quebra = { x: x * T + T / 2, y: y * T + T / 2, inicio: raiz.performance.now(), lascas: lascas };
    var area = canvas.parentNode;
    area.classList.remove('treme');
    void area.offsetWidth;
    if (!reduzido) area.classList.add('treme');
  }

  /* ---------------------------------------------------------
     8. Interface pública
     --------------------------------------------------------- */

  function ajustarResolucao() {
    dpr = Math.min(raiz.devicePixelRatio || 1, 2);
    canvas.width = LARG * dpr; canvas.height = ALT * dpr;
    luz.width = LARG * dpr; luz.height = ALT * dpr;
    desenharBase();
  }

  var Mapa = {
    SALAS_NOMEADAS: SALAS,

    iniciar: function (elemento, cbs) {
      canvas = elemento;
      ctx = canvas.getContext('2d');
      luz = document.createElement('canvas');
      lctx = luz.getContext('2d');
      callbacks = cbs || {};
      reduzido = raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches;
      construirGrade();
      jogo = novoJogo();
      ajustarResolucao();
      raiz.addEventListener('resize', function () {
        var novo = Math.min(raiz.devicePixelRatio || 1, 2);
        if (novo !== dpr) ajustarResolucao();
      });
      raiz.requestAnimationFrame(quadro);
    },

    mover: mover,

    reiniciar: function () { jogo = novoJogo(); },

    // Modo Roteiro: mostra a sala do estado atual e as salas já visitadas
    mostrarEstado: function (estado, visitadas) { vitrine = { estado: estado, visitadas: visitadas }; },
    sairDaVitrine: function () { vitrine = null; },

    // Converte um ladrilho do mapa em coordenadas da tela (para animações na página)
    pontoNaTela: function (x, y) {
      var r = canvas.getBoundingClientRect();
      return { x: r.left + (x + 0.5) * T * (r.width / LARG), y: r.top + (y + 0.5) * T * (r.height / ALT) };
    },

    encerrado: function () { return jogo.encerrado; }
  };

  raiz.Mapa = Mapa;
})(window);
