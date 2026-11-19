// =====================================================================
// servidor.ts — o servidor central do RedeZap (porta 9990)
// =====================================================================
// TCP 9990: cadastro dos clientes e lista de contatos
// UDP 9990: grupo (recebe uma mensagem e reenvia para todos)
//
// Como rodar:  node src/servidor.ts
import net from 'node:net';
import dgram from 'node:dgram';
import { PORTA_SERVIDOR, enviarTcp, receberTcp, lerJson, limparIp, cor, } from "./protocolo.js";
const cadastrados = new Map();
function listaDeContatos() {
    return [...cadastrados.values()].map((c) => c.contato);
}
function avisarTodos(msg, menos) {
    for (const [nick, c] of cadastrados) {
        if (nick !== menos)
            enviarTcp(c.conexao, msg);
    }
}
function log(protocolo, texto) {
    const etiqueta = protocolo === 'TCP' ? cor.azul('[TCP]') : cor.amarelo('[UDP]');
    console.log(`${etiqueta} ${texto}`);
}
function mostrarTabela() {
    console.log(cor.negrito(`\n  Lista de contatos (${cadastrados.size})`));
    if (cadastrados.size === 0) {
        console.log(cor.cinza('  (vazia)\n'));
        return;
    }
    console.table(listaDeContatos());
}
// =====================================================================
// TCP — cadastro e lista de contatos
// =====================================================================
const servidorTcp = net.createServer((conexao) => {
    const ip = limparIp(conexao.remoteAddress);
    let meuNick = null; // fica preenchido depois do cadastro
    log('TCP', `nova conexão de ${ip}:${conexao.remotePort}`);
    receberTcp(conexao, (msg) => {
        // ---- 1) CADASTRO: guarda NICK, IP e PORTA ----
        if (msg.tipo === 'CADASTRO') {
            const nick = msg.nick.trim();
            if (!/^[\p{L}\d_]{2,15}$/u.test(nick)) {
                enviarTcp(conexao, { tipo: 'ERRO', texto: 'Nick inválido: use de 2 a 15 letras ou números, sem espaço.' });
                return;
            }
            if (cadastrados.has(nick)) {
                enviarTcp(conexao, { tipo: 'ERRO', texto: `O nick "${nick}" já está em uso.` });
                return;
            }
            meuNick = nick;
            const contato = { nick, ip, porta: msg.porta };
            cadastrados.set(nick, { contato, conexao });
            log('TCP', `${cor.negrito(nick)} se cadastrou (${ip}:${msg.porta})`);
            enviarTcp(conexao, { tipo: 'BEM_VINDO', contatos: listaDeContatos() });
            avisarTodos({ tipo: 'ENTROU', contato }, nick); // sincroniza os outros
            mostrarTabela();
            return;
        }
        // Daqui pra baixo, só quem já fez o cadastro
        if (!meuNick) {
            enviarTcp(conexao, { tipo: 'ERRO', texto: 'Faça o cadastro primeiro.' });
            return;
        }
        // ---- 2) PEDIR_LISTA: devolve a lista de contatos ----
        if (msg.tipo === 'PEDIR_LISTA') {
            log('TCP', `${meuNick} pediu a lista de contatos`);
            enviarTcp(conexao, { tipo: 'LISTA', contatos: listaDeContatos() });
        }
    });
    // ---- 3) Saída: tira da lista e avisa os outros ----
    conexao.on('close', () => {
        if (meuNick && cadastrados.get(meuNick)?.conexao === conexao) {
            cadastrados.delete(meuNick);
            log('TCP', `${cor.negrito(meuNick)} saiu`);
            avisarTodos({ tipo: 'SAIU', nick: meuNick });
            mostrarTabela();
        }
    });
    conexao.on('error', () => { });
});
// =====================================================================
// UDP — o grupo (broadcast pelo servidor)
// =====================================================================
const servidorUdp = dgram.createSocket('udp4');
servidorUdp.on('message', (dados, origem) => {
    const msg = lerJson(dados.toString('utf8'));
    if (!msg || msg.tipo !== 'GRUPO')
        return;
    // Só repassa se quem mandou está cadastrado e usou a porta que informou
    const remetente = cadastrados.get(msg.de);
    if (!remetente || remetente.contato.porta !== origem.port) {
        log('UDP', cor.vermelho(`datagrama ignorado de ${origem.address}:${origem.port} (não cadastrado)`));
        return;
    }
    // Reenvia para todos os outros cadastrados
    const datagrama = Buffer.from(JSON.stringify(msg));
    let quantos = 0;
    for (const [nick, c] of cadastrados) {
        if (nick === msg.de)
            continue;
        servidorUdp.send(datagrama, c.contato.porta, c.contato.ip);
        quantos++;
    }
    log('UDP', `${cor.negrito(msg.de)} -> grupo: "${msg.texto}"  (reenviado para ${quantos})`);
    // O UDP não confirma nada. Então o nosso protocolo avisa quem mandou
    // quantas pessoas receberam o repasse (não garante que chegou):
    const recibo = { tipo: 'ENTREGUE', quantos };
    servidorUdp.send(Buffer.from(JSON.stringify(recibo)), origem.port, origem.address);
});
// =====================================================================
// Liga os dois
// =====================================================================
servidorTcp.listen(PORTA_SERVIDOR, () => {
    servidorUdp.bind(PORTA_SERVIDOR, () => {
        console.log(cor.verde(cor.negrito('\n  RedeZap: servidor no ar')));
        console.log(`  TCP ${PORTA_SERVIDOR}: cadastro e lista de contatos`);
        console.log(`  UDP ${PORTA_SERVIDOR}: grupo (um para todos)`);
        console.log(cor.cinza('  Aguardando clientes... (Ctrl+C para desligar)\n'));
    });
});
servidorTcp.on('error', (erro) => {
    if (erro.code === 'EADDRINUSE') {
        console.error(cor.vermelho(`A porta ${PORTA_SERVIDOR} já está em uso. Já tem um servidor aberto?`));
        process.exit(1);
    }
    throw erro;
});
