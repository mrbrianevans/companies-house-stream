import express from "express"

const app = express()

app.use((req, res, next) => {
  console.log("Request to", req.path)
  next()
})

app.get("/getCompanyInfo", (req, res) => {
  res.status(404).send("not implemented yet")
})

app.get("/health", (req, res) => {
  res.status(200).send("healthy")
})


await new Promise<void>(resolve => app.listen(3000, resolve))

