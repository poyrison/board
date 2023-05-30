const router = require("express").Router();

router.get("/logout", (req, res, next) => {
  req.logout(() => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

module.exports = router;
