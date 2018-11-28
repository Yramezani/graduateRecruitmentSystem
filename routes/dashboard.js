const Profile = require("../models/user").profile;
const auth = require("../middleware/auth");
const User = require("../models/user").user;
const validate = require("../models/user").validate;
const Position = require("../models/position").position;
const Message = require("../models/position").message;
const Application = require("../models/position").application;
const bcrypt = require("bcryptjs");
const router = require("../router");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
// router.use(
//   session({ secret: "atest", resave: false, saveUninitialized: true })
// );

const urlenCodedParser = bodyParser.urlencoded({ extended: false });

router.get("/", urlenCodedParser, async (req, res) => {
  if (req.session.user_type !== "S")
    res.send("Un-Authorized - Please go to admin's dashboard");
  else {
    profile = await Profile.findOne({ where: { id: req.session.user_id } });
    if (!profile) res.render("profile");
    // console.log(req.session.user_id); //accessing session data but it gives undefined
    else {
      if (profile.ms_degree === "NA") {
        const position = await Position.findAll({
          where: {
            Specialization: profile.bs_specialization,
            level: {
              [Op.ne]: "PHD"
            }
          },
          order: [["id", "ASC"], ["createdAt", "ASC"]]
        }).error(function(err) {
          console.log("Error:" + err);
        });

        res.render("dashboard", { position: position });
      } else {
        const position = await Position.findAll({
          where: {
            Specialization: profile.ms_specialization
          },
          order: [["id", "ASC"], ["createdAt", "ASC"]]
        }).error(function(err) {
          console.log("Error:" + err);
        });

        res.render("dashboard", { position: position });
      }
    }
  }
});

router.get("/positions/:id", async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    const position = await Position.findOne({
      where: {
        id: req.params.id
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });

    const message = await Message.findAll({
      where: {
        position_id: req.params.id,
        [Op.or]: [
          { sender_id: req.session.user_id },
          { receiver_id: req.session.user_id }
        ]
      },
      order: [["id", "ASC"], ["createdAt", "ASC"]]
    }).error(function(err) {
      console.log("Error:" + err);
    });

    const app = await Application.findOne({
      where: {
        applicant_id: req.session.user_id,
        // decision: "A",
        position_id: req.params.id
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });
    let decision = "X";
    if (app) decision = app.decision;

    res.render("position", {
      position: position,
      message: message,
      decision: decision
    });
  }
});

router.get("/messages/:p_id/:r_id", async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    // console.log(req.body.messagetxt);
    await Message.create({
      sender_id: req.session.user_id,
      position_id: req.params.p_id,
      message_txt: req.query.messagetxt,
      receiver_id: req.params.r_id,
      admin_read: "N",
      student_read: "Y"
    });
    // res.writeHead(200, {
    //   "Content-Type": mimeType,
    //   "Content-Length": contents.length,
    //   "Accept-Ranges": "bytes",
    //   "Cache-Control": "no-cache"
    // });
    res.redirect(`/api/dashboard/positions/${req.params.p_id}`);
  }
});

router.get("/apply/:p_id", async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    const position = await Position.findOne({
      where: {
        id: req.params.p_id
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });

    res.render("apply", { position: position });
  }
});

router.post("/apply", urlenCodedParser, async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    const app = await Application.findOne({
      where: {
        applicant_id: req.session.user_id,
        decision: "A"
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });

    if (app)
      res.send("You have already accepted an offer, cannot apply anymore");
    else {
      const position = await Position.findOne({
        where: {
          id: req.body.positionid
        }
      }).error(function(err) {
        console.log("Error:" + err);
      });

      const application = await Application.findOne({
        where: {
          applicant_id: req.session.user_id,
          position_id: req.body.positionid
        }
      }).error(function(err) {
        console.log("Error:" + err);
      });
      if (application)
        res.send("Cannot re-apply, you have already applied for this position");
      else {
        await Application.create({
          applicant_id: req.session.user_id,
          position_id: req.body.positionid,
          cover_letter: req.body.description,
          admin_id: position.userId
        });
      }
      res.send("Successfully Applied");
    }
  }
});

router.get("/offers", urlenCodedParser, async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    const application = await Application.findAll({
      where: {
        applicant_id: req.session.user_id,
        decision: ["O", "A"]
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });
    if (!application) res.send("No Admission Offers");
    else {
      const pos = application.map(a => a.position_id);
      const position = await Position.findAll({
        where: {
          id: pos
        }
      }).error(function(err) {
        console.log("Error:" + err);
      });

      res.render("offers", { application: application, position: position });
    }
  }
});

router.get("/accept_offer/:a_id/:p_id", urlenCodedParser, async (req, res) => {
  if (req.session.user_type !== "S") res.send("Un-Authorized Access");
  else {
    const app = await Application.findAndCountAll({
      where: {
        position_id: req.params.p_id,
        decision: "A"
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });

    const appl = await Application.findOne({
      where: {
        applicant_id: req.session.user_id,
        decision: "A"
      }
    }).error(function(err) {
      console.log("Error:" + err);
    });

    if (appl)
      res.send("You have already accepted an offer, cannot accept another one");
    else {
      const position = await Position.findOne({
        where: {
          id: req.params.p_id
        }
      }).error(function(err) {
        console.log("Error:" + err);
      });
      console.log(app.count);
      console.log(position.number_of_positions);
      if (app.count >= position.number_of_positions)
        res.send(
          "You are late, other applicants have already accepted and positions are now filled"
        );
      else {
        //update decision in applications table Accepted using application_id in comments
        const application = await Application.update(
          { decision: "A" },
          {
            where: {
              id: req.params.a_id
            }
          }
        )
          .error(function(err) {
            console.log("Error:" + err);
          })
          .then(count => {
            if (count) return count;
          });

        if (application) res.send("Offer Accepted");
        else res.send("Some Error Occured");
      }
    }
  }
});
router.get("/forgotPassword", urlenCodedParser, async (req, res) => {
  res.render("forgotPassword");
});

router.post("/forgotPassword", urlenCodedParser, async (req, res) => {
  if (!req.session.user_id) {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let user = await User.findOne({
      where: { email: req.body.email, username: req.body.username }
    });
    if (!user)
      return res.status(400).send("Could not find any user with these details");
    //   user = await Use.findOne({ where: { userId: req.body.userId } });
    //   if (user) return res.status(400).send("UserId already exists.");
    else {
      const salt = await bcrypt.genSalt(5);
      const hashed = await bcrypt.hash(req.body.password, salt);

      const upd = await User.update(
        {
          password: hashed
        },
        {
          where: {
            id: user.id
          }
        }
      );
      if (upd) res.render("home");
      else res.send("Password could not be updated");
    }
  } else {
    res.send("User already logged in, redirecting to home");
    // sleep.sleep(2);
    res.redirect("/api/dashboard");
  }
  //   .then(use => res.send(`user registered`));
  //   console.log(req.body);
  //   res.send("user registered");
});

module.exports = router;
