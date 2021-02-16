import {Request, Response} from "express";
import {StreamCompanies} from "./server/companiesStream";
import {StreamCharges} from "./server/chargesStream";
import {StreamFilings} from "./server/filingStream";
import {StreamInsolvencies} from "./server/insolvencyStream";
import {Pool} from "pg";
import {generateGraphData} from "./server/graphDataGenerator";

const express = require('express');
const server = express()
const httpServer = require('http').Server(server)
const io = require('socket.io')(httpServer)
const path = require('path')
const fs = require('fs')
const pool = new Pool();
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

server.get('/graphdata', async (req: Request, res: Response) => {
    await generateGraphData(req, res, pool)
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

httpServer.listen(3000, () => console.log(`\x1b[32mListening on http://localhost:3000\x1b[0m\nGraph on http://localhost:3000/graph\n`))

StreamCompanies(io, 'live', pool)
StreamCharges(io, 'live', pool)
StreamFilings(io, 'live', pool)
StreamInsolvencies(io, 'live', pool)

setInterval(() => {
    console.log("Starting all streams (24th hour interval)")
    StreamCompanies(io, 'live', pool)
    StreamCharges(io, 'live', pool)
    StreamFilings(io, 'live', pool)
    StreamInsolvencies(io, 'live', pool)
    // reset the stream every 24 hours 150 milliseconds
}, 1000 * 60 * 60 * 24 + 150)

