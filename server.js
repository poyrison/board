const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use("/public", express.static("public"));
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
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
  res.render("index.ejs");
});

app.get("/write", (req, res) => {
  res.render("write.ejs");
});

app.get("/edit/:id", (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      res.render("edit.ejs", { post: result });
    }
  );
});

app.put("/edit", (req, res) => {
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) },
    { $set: { title: req.body.title, date: req.body.date } },
    (err, result) => {
      res.redirect("/list");
    }
  );
});

app.get("/list", (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      res.render("list.ejs", { posts: result });
    });
});

app.get("/detail/:id", (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    function (err, result) {
      res.render("detail.ejs", { posts: result });
    }
  );
});

app.post("/add", (req, res) => {
  res.render("write.ejs");

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
  console.log(`=== 삭제한 게시물 번호: ${req.body._id} ===`);
  req.body._id = parseInt(req.body._id);
  db.collection("post").deleteOne(req.body, (err, result) => {
    err && console.log(err);
    res.status(200).send({ message: "성공했습니다." });
  });
});
