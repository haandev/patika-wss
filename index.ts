import { asciify } from './src/utils/asciify'
import { createServer } from 'http'
import express from 'express'
import { SocketServer } from './src/classes/SocketServer'

const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
const server = createServer(app)


const gcss = new SocketServer({ server})

/**
 * example simple login, password is not necessary
 */

;(async () => {
  await asciify("PATIKA SOCKET", { font: 'starwars', color: 'green' })
  server.listen(process.env.PORT || 5000)
})()
