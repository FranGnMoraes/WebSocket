// =====================================================================
// cliente.ts — o cliente do RedeZap
// =====================================================================
// Cada cliente tem UMA porta própria, usada para duas coisas:
//   TCP nessa porta: recebe conversas privadas direto de outro cliente
//   UDP nessa porta: recebe as mensagens do grupo vindas do servidor
//
// Como rodar:  node src/cliente.ts Fran
//              node src/cliente.ts Fran 192.168.0.10   (servidor em outra máquina)
import net from 'node:net';
import dgram from 'node:dgram';
import readline from 'node:readline';
import { PORTA_SERVIDOR, enviarTcp, receberTcp, lerJson, horaAgora, cor, } from "./protocolo.js";
const ipServidor = process.argv[3] ?? '127.0.0.1';
// Lista de contatos que este cliente conhece (sincronizada pelo servidor)
const contatos = new Map();
// Conversas privadas abertas: nick do outro -> conexão TCP direta
const privadas = new Map();
let meuNick = '';
let minhaPorta = 0;
// ---------------------------------------------------------------------
// Tela: escreve uma linha sem bagunçar o que a pessoa está digitando
// ---------------------------------------------------------------------
const tela = readline.createInterface({ input: process.stdin, output: process.stdout });
let telaFechada = false;
tela.on('close', () => { telaFechada = true; });
function mostrar(texto) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(texto);
    if (!telaFechada)
        tela.prompt(true);
}
function mostrarContatos() {
    const linhas = [...contatos.values()].map((c) => {
        const eu = c.nick === meuNick ? cor.cinza(' (você)') : '';
        return `   ${cor.negrito(c.nick.padEnd(15))} ${c.ip}:${c.porta}${eu}`;
    });
    mostrar(`${cor.azul('Contatos online:')}\n${linhas.join('\n')}`);
}
function mostrarAjuda() {
    mostrar([
        cor.negrito('Comandos:'),
        `   ${cor.verde('texto qualquer')}        manda no GRUPO (UDP, passa pelo servidor)`,
        `   ${cor.roxo('/pv nick mensagem')}     conversa PRIVADA (TCP, direto com o outro cliente)`,
        `   ${cor.azul('/lista')}                pede a lista de contatos ao servidor (TCP)`,
        `   /ajuda                mostra esta ajuda`,
        `   /sair                 sai do RedeZap`,
    ].join('\n'));
}
// =====================================================================
// 1) Abre a porta do cliente: TCP (privado) + UDP (grupo) no mesmo número
// =====================================================================
const escutaPrivada = net.createServer();
const udp = dgram.createSocket('udp4');
function abrirMinhaPorta(tentativa = 1) {
    return new Promise((resolve, reject) => {
        escutaPrivada.listen(0, () => {
            const porta = escutaPrivada.address().port;
            udp.once('error', () => {
                escutaPrivada.close(() => {
                    if (tentativa >= 5)
                        reject(new Error('Não consegui abrir uma porta.'));
                    else
                        abrirMinhaPorta(tentativa + 1).then(resolve, reject);
                });
            });
            udp.bind(porta, () => resolve(porta));
        });
    });
}
// =====================================================================
// 2) Conversa PRIVADA — TCP direto entre os clientes (sem o servidor)
// =====================================================================
function prepararConversa(conexao, nickDoOutro) {
    let outro = nickDoOutro;
    receberTcp(conexao, (msg) => {
        if (msg.tipo === 'OLA') { // quem abriu a conversa se apresenta
            outro = msg.nick;
            privadas.set(outro, conexao);
            mostrar(cor.cinza(`(${outro} abriu uma conversa privada com você)`));
        }
        else if (msg.tipo === 'PRIVADO') {
            mostrar(`${cor.cinza(msg.hora)} ${cor.roxo(`[privado] ${msg.de}:`)} ${msg.texto}`);
        }
    });
    conexao.on('close', () => {
        if (outro && privadas.get(outro) === conexao) {
            privadas.delete(outro);
            mostrar(cor.cinza(`(conversa privada com ${outro} encerrada)`));
        }
    });
    conexao.on('error', () => { });
}
// Alguém abriu uma conversa privada comigo
escutaPrivada.on('connection', (conexao) => prepararConversa(conexao, null));
function mandarPrivado(destino, texto) {
    if (destino === meuNick) {
        mostrar(cor.vermelho('Não dá para mandar mensagem privada para você.'));
        return;
    }
    const msg = { tipo: 'PRIVADO', de: meuNick, texto, hora: horaAgora() };
    // Já tem conversa aberta? Usa a mesma conexão.
    const aberta = privadas.get(destino);
    if (aberta) {
        enviarTcp(aberta, msg);
        mostrar(cor.cinza(`   ✓ enviado direto para ${destino} (TCP)`));
        return;
    }
    // Não tem: pega IP e porta da lista de contatos e conecta DIRETO no outro
    const contato = contatos.get(destino);
    if (!contato) {
        mostrar(cor.vermelho(`"${destino}" não está na lista. Use /lista para ver quem está online.`));
        return;
    }
    mostrar(cor.cinza(`(abrindo conexão TCP direta com ${destino} em ${contato.ip}:${contato.porta}...)`));
    const conexao = net.connect(contato.porta, contato.ip, () => {
        privadas.set(destino, conexao);
        enviarTcp(conexao, { tipo: 'OLA', nick: meuNick });
        enviarTcp(conexao, msg);
        mostrar(cor.cinza(`   ✓ enviado direto para ${destino} (TCP)`));
    });
    prepararConversa(conexao, destino);
    conexao.once('error', () => mostrar(cor.vermelho(`Não consegui conectar em ${destino}.`)));
}
// =====================================================================
// 3) GRUPO — UDP, passando pelo servidor
// =====================================================================
function mandarNoGrupo(texto) {
    const msg = { tipo: 'GRUPO', de: meuNick, texto, hora: horaAgora() };
    udp.send(Buffer.from(JSON.stringify(msg)), PORTA_SERVIDOR, ipServidor);
}
udp.on('message', (dados) => {
    const msg = lerJson(dados.toString('utf8'));
    if (!msg)
        return;
    if (msg.tipo === 'GRUPO') {
        mostrar(`${cor.cinza(msg.hora)} ${cor.verde(`[grupo] ${msg.de}:`)} ${msg.texto}`);
    }
    else if (msg.tipo === 'ENTREGUE') {
        // O "✓" quer dizer que o SERVIDOR repassou. O UDP não garante que chegou.
        if (msg.quantos === 0)
            mostrar(cor.cinza('   ✓ o servidor recebeu, mas não tem mais ninguém no grupo'));
        else
            mostrar(cor.cinza(`   ✓ o servidor repassou para ${msg.quantos === 1 ? '1 pessoa' : `${msg.quantos} pessoas`}`));
    }
});
// =====================================================================
// 4) Conexão com o SERVIDOR — TCP 9990 (cadastro e lista)
// =====================================================================
function conectarNoServidor() {
    const servidor = net.connect(PORTA_SERVIDOR, ipServidor, () => {
        enviarTcp(servidor, { tipo: 'CADASTRO', nick: meuNick, porta: minhaPorta });
    });
    receberTcp(servidor, (msg) => {
        switch (msg.tipo) {
            case 'BEM_VINDO':
                for (const c of msg.contatos)
                    contatos.set(c.nick, c);
                mostrar(cor.verde(cor.negrito(`\nOlá, ${meuNick}! Você entrou no RedeZap.`)) +
                    cor.cinza(` (sua porta: ${minhaPorta})`));
                mostrarContatos();
                mostrarAjuda();
                break;
            case 'LISTA':
                contatos.clear();
                for (const c of msg.contatos)
                    contatos.set(c.nick, c);
                mostrarContatos();
                break;
            case 'ENTROU':
                contatos.set(msg.contato.nick, msg.contato);
                mostrar(cor.azul(`>> ${msg.contato.nick} entrou`));
                break;
            case 'SAIU':
                contatos.delete(msg.nick);
                mostrar(cor.azul(`<< ${msg.nick} saiu`));
                break;
            case 'ERRO':
                mostrar(cor.vermelho(`Servidor: ${msg.texto}`));
                process.exit(1);
        }
    });
    servidor.on('close', () => {
        mostrar(cor.vermelho('Conexão com o servidor encerrada.'));
        process.exit(0);
    });
    servidor.on('error', () => {
        console.error(cor.vermelho(`Não achei o servidor em ${ipServidor}:${PORTA_SERVIDOR}. Ele está ligado?`));
        process.exit(1);
    });
    return servidor;
}
// =====================================================================
// 5) Começo do programa
// =====================================================================
async function iniciar() {
    meuNick = process.argv[2] ?? await new Promise((r) => tela.question('Seu nick: ', r));
    meuNick = meuNick.trim();
    minhaPorta = await abrirMinhaPorta();
    const servidor = conectarNoServidor();
    tela.setPrompt(cor.cinza('> '));
    tela.on('line', (linha) => {
        const texto = linha.trim();
        if (texto === '') {
            tela.prompt();
        }
        else if (texto === '/sair') {
            servidor.end();
        }
        else if (texto === '/lista') {
            enviarTcp(servidor, { tipo: 'PEDIR_LISTA' });
        }
        else if (texto === '/ajuda') {
            mostrarAjuda();
        }
        else if (texto.startsWith('/pv ')) {
            const [, destino, ...resto] = texto.split(' ');
            if (!destino || resto.length === 0)
                mostrar(cor.vermelho('Use: /pv nick mensagem'));
            else
                mandarPrivado(destino, resto.join(' '));
        }
        else if (texto.startsWith('/')) {
            mostrar(cor.vermelho('Comando desconhecido. Digite /ajuda.'));
        }
        else {
            mandarNoGrupo(texto);
        }
        if (!telaFechada)
            tela.prompt();
    });
    tela.on('close', () => servidor.end()); // Ctrl+C / Ctrl+D
}
iniciar();
