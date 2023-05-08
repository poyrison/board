const express = require("express");
const app = express();

const address = 8080;

app.listen(`${address}`, function () {
  console.log("서버 오픈");
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/pet", function (req, res) {
  res.send("펫 용품 사세요");
});

app.get("/beauty", function (req, res) {
  res.send("뷰티 용품 사세요");
});
