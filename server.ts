import {Request, Response} from "express";
import {StreamCompanies} from "./server/companiesStream";
import {StreamCharges} from "./server/chargesStream";
import {StreamFilings} from "./server/filingStream";
import {StreamInsolvencies} from "./server/insolvencyStream";
import {Pool} from "pg";

const express = require('express');
const server = express()
const httpServer = require('http').Server(server)
const io = require('socket.io')(httpServer)
const path = require('path')
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});
server.get('/', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'index.html'))
})

server.get('/js', (req: Request, res: Response)=>{
    res.sendFile(path.resolve(__dirname, 'client', 'client.js'))
})
server.get('/css', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'client', 'stylesheet.css'))
})
io.on('connection', () => {
    // console.log("\n\x1b[36mNew connection started\x1b[0m")
})
httpServer.listen(3000, () => console.log(`\x1b[32mListening on http://localhost:3000\x1b[0m`))

StreamCompanies(io, 'live', pool)
StreamCharges(io, 'live', pool)
StreamFilings(io, 'live', pool)
StreamInsolvencies(io, 'live', pool)
