import {Request, Response} from "express";
import {StreamCompanies} from "./server/companiesStream";
import {StreamCharges} from "./server/chargesStream";
import {StreamFilings} from "./server/filingStream";
import {StreamInsolvencies} from "./server/insolvencyStream";

const express = require('express');
const server = express()
const httpServer = require('http').Server(server)
const io = require('socket.io')(httpServer)
const path = require('path')
const fs = require('fs')
server.get('/', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'index.html'))
})
server.get('/graph', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'graph.html'))
})

server.get('/graphjs', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'graph.js'))
})

server.get('/js', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'client.js'))
})


server.get('*.css', (req: Request, res: Response) => {
    if (!req.path.match(/\/([^\/]*).css/))
        res.status(400).end("Badly formatted request")
    const filename = req.path.match(/\/([^\/]*).css/)[1]
    const filepath = path.resolve(__dirname, 'client', filename + '.css')
    if (!fs.existsSync(filepath))
        res.status(404).end("Not found")
    res.sendFile(filepath)
})
const port = 3000
httpServer.listen(port, () => console.log(`\x1b[32mListening on http://localhost:${port}\x1b[0m\nGraph on http://localhost:${port}/graph\n`))

StreamCompanies(io, 'live')
StreamCharges(io, 'live')
StreamFilings(io, 'live')
StreamInsolvencies(io, 'live')

setInterval(() => {
    console.log("Starting all streams (24th hour interval)")
    StreamCompanies(io, 'live')
    StreamCharges(io, 'live')
    StreamFilings(io, 'live')
    StreamInsolvencies(io, 'live')
    // reset the stream every 24 hours 150 milliseconds
}, 1000 * 60 * 60 * 24 + 150)

