const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));

const MongoClient = require("mongodb").MongoClient;

let db;
let id_num = 0;

MongoClient.connect(
  "mongodb+srv://admin:rlawnstlr12@poyrison.x9syqyy.mongodb.net/?retryWrites=true&w=majority",
  { useUnifiedTopology: true },
  function (err, client) {
    if (err) return console.log(err);
    // 연결되면 할 일
    db = client.db("todoapp");

    // db.collection("post").insertOne(
    //   { _id: 0, 이름: "John", 나이: "20" },
    //   function (err, res) {
    //     console.log("저장 완료");
    //   }
    // );

    app.listen(8080, () => {
      console.log("서버 오픈");
    });
  }
);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/write", (req, res) => {
  res.sendFile(__dirname + "/write.html");
});

app.post("/add", (req, res) => {
  res.send("전송 완료");
  db.collection("post").insertOne(
    { _id: `${id_num}`, name: req.body.title, date: req.body.date },
    function () {
      console.log("저장 완료");
    }
  );
  id_num++;
});
