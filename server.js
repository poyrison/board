const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const MongoClient = require("mongodb").MongoClient;

let db;
const address = 8080;

MongoClient.connect(
  "mongodb+srv://admin:rlawnstlr12@poyrison.x9syqyy.mongodb.net/?retryWrites=true&w=majority",
  { useUnifiedTopology: true },
  (err, client) => {
    if (err) return console.log(err);
    // 연결되면 할 일
    db = client.db("todoapp");

    app.listen(`${address}`, () => {
      console.log(`[ ${address} Server Open  ]`);
    });
  }
);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/write", (req, res) => {
  res.sendFile(__dirname + "/write.html");
});

app.get("/list", (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      console.log(result);
      res.render("list.ejs", { posts: result });
    });
});

app.post("/add", (req, res) => {
  res.sendFile(__dirname + "/write.html");

  db.collection("counter").findOne({ name: "게시물갯수" }, (err, result) => {
    console.log(result.totalPost);
    let totalPost = result.totalPost;

    db.collection("post").insertOne(
      { _id: totalPost + 1, name: req.body.title, date: req.body.date },
      () => {
        console.log("저장 완료");
        db.collection("counter").updateOne(
          { name: "게시물갯수" },
          { $inc: { totalPost: 1 } },
          (err, result) => {
            err && console.log(err);
          }
        );
      }
    );
  });
});

app.delete("/delete", (req, res) => {
  console.log(req.body);
  req.body._id = parseInt(req.body._id);
  db.collection("post").deleteOne(req.body, (err, result) => {
    err && console.log(err);
  });
});
