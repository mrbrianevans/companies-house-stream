import {Request, Response} from "express";
import {BasicCompanyEvent} from "./eventTypes";

const request = require('request');
const express = require('express');
const server = express()
const httpServer = require('http').Server(server)
const io = require('socket.io')(httpServer)
const path = require('path')

server.get('/', (req: Request, res: Response)=>{
    res.sendFile(path.resolve(__dirname, 'client', 'index.html'))
})

server.get('/js', (req: Request, res: Response)=>{
    res.sendFile(path.resolve(__dirname, 'client', 'client.js'))
})
server.get('/css', (req: Request, res: Response)=>{
    res.sendFile(path.resolve(__dirname, 'client', 'stylesheet.css'))
})
io.on('connection', ()=> {
  console.log("\n\x1b[36mNew connection started\x1b[0m")
})

//Variables for status update:
let latestTimepoint = ''
let numberOfPackets = 0
let numberOfHeartbeats = 0
let numberOfEvents = 0
let numberOfNewCompanies = 0
let startTime = Date.now()
let streamPaused = false

const printUpdate = () => {
  process.stdout.clearLine(-1, ()=>{
    process.stdout.cursorTo(0)
    process.stdout.write(`Running for ${Math.round((Date.now()-startTime)/1000)}s | Latest timepoint: ${latestTimepoint} | Packets: ${numberOfPackets} | Heartbeats: ${numberOfHeartbeats} | Events: ${numberOfEvents} | New companies: ${numberOfNewCompanies} | Stream ${streamPaused?'\x1b[31mpaused\x1b[0m':'\x1b[32mready\x1b[0m'}`)
  })
}

const logEvent = (e: BasicCompanyEvent) => {
  io.emit('event', e)
  let timepoint = e.event.timepoint
  latestTimepoint = timepoint.toString()
  numberOfEvents++
  let dateOfCreation = e.data.date_of_creation
  if(new Date(dateOfCreation).valueOf()>Date.now()-86400000) numberOfNewCompanies++
}

let dataBuffer = ''
const reqStream = request.get('https://stream.companieshouse.gov.uk/companies')
  .auth('q5YBtCQHw5a-T-I3HBkJsOfRG4szpz2y1VHa2gQ2', '')
  .on('response', (r: any) => {
    console.log("Headers received, status", r.statusCode)
    switch (r.statusCode) {
      case 200:
        httpServer.listen(3000, ()=>console.log(`\x1b[32mListening on http://localhost:3000\x1b[0m`))
        setInterval(printUpdate, 500)
        break;
      case 416:
        console.log("Timepoint out of data")
        break;
      case 429:
        console.log("RATE LIMITED, exiting now")
        process.exit()
        break;
      default:
        process.exit()
    }
  })
  .on('error', (e: any) => console.error('error', e))
  .on('data', async (d: any) => {
    if(d.toString().length > 1) {
      streamPaused = true
      reqStream.pause()

      numberOfPackets++
      dataBuffer += d.toString('utf8')
      while (dataBuffer.includes('\n')) {
        let newLinePosition = dataBuffer.search('\n')
        let jsonText = dataBuffer.slice(0, newLinePosition)
        dataBuffer = dataBuffer.slice(newLinePosition + 1)
        try {
          let jsonObject = JSON.parse(jsonText)
          logEvent(jsonObject)
        } catch (e) {
          console.error(`\x1b[31mCOULD NOT PARSE: \x1b[0m*${jsonText}*`)
        }
      }
      streamPaused = false
      reqStream.resume()
    }else{
      numberOfHeartbeats++
      io.emit('heartbeat', {})
    }
  })


