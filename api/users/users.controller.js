const USERModel = require('./users.model');
const POSTModel= require('../posts/posts.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const token_list = {};

module.exports = {getUsers, getUserByUsername, registerUser, loginUser, refreshToken, editUser, deleteUser};


async function getUsers(req, res) {
  let page = 1;

  if (req.query.page) {
    page = parseInt(req.query.page);

    if (!Number.isInteger(page) || page < 1) return res.status(400).json({ message: "Bad Request" });
  }

  const PAGE_SIZE = 10;
  const skip = (page - 1) * PAGE_SIZE;

  return USERModel.find()
  .select('name role country photoUrl -_id')
  .skip(skip)
  .limit(PAGE_SIZE)
  .then(response => {
    if (response.length === 0 && page > 1) return res.status(404).json({ message: "Page Not Found" });

    return res.json(response);
  })
  .catch(error => {
    return res.status(500).json(error);
  });
}


async function getUserByUsername(req, res) {
  const username = req.params.username;

  if (req.token && req.token.user.username === username) {
    return USERModel.findOne({username: username})
    .select('-_id -password')
    .populate('postsId')
    .then(response => {
      if (!response) return res.status(404).json({ message: "Page Not Found" });
      
      return res.json(response);
    })
    .catch(error => {
      return res.status(500).json(error);
    });
  } else {
    return USERModel.findOne({username: username})
    .select('-_id -username -email -password')
    .populate('postsId')
    .then(response => {
      if (!response) return res.status(404).json({ message: "Page Not Found" });
      
      return res.json(response);
    })
    .catch(error => {
      return res.status(500).json(error);
    });
  }
}


async function registerUser(req, res) {
  if (!req.body.password) return res.status(400).json({ message: "Password Can't Be Empty" });

  req.body.password = bcrypt.hashSync(req.body.password, 10);

  return USERModel.create(req.body)
  .then(() => {
    return getUsers(req, res);
  })
  .catch(error => {
    return res.status(500).json(error);
  });
}

async function loginUser(req, res) {
  return USERModel.findOne({ username: req.body.username })
  .then(response => {
    if (!response) {
      return res.status(400).json({ message: "Invalid User Or Password" });
    }

    if (!bcrypt.compareSync(req.body.password, response.password)) {
        return res.status(400).json({ message: "Invalid User Or Password" });
    }

    const token = jwt.sign({ user: response }, process.env.TOKEN_KEY, { expiresIn: 300 });
    const refresh_token = jwt.sign({ user: response }, process.env.REFRESH_TOKEN_KEY, { expiresIn: 86400 });

    token_list[refresh_token] = {username: req.body.username, token: token};

    return res.json({ token: token, refreshToken: refresh_token });
  })
  .catch(error => {
    return res.status(500).json(error)
  })
}

async function refreshToken(req, res) {
  return USERModel.findOne({ username: req.body.username })
  .then(response => {
    if (!response) {
      return res.status(400).json({ message: "Invalid User Or Password" });
    }

    if (!bcrypt.compareSync(req.body.password, response.password)) {
        return res.status(400).json({ message: "Invalid User Or Password" });
    }

    if((req.body.refreshToken) && (req.body.refreshToken in token_list)) {
      const token = jwt.sign({ user: response }, process.env.TOKEN_KEY, { expiresIn: 300 });
      
      token_list[req.body.refreshToken].token = token;

      return res.json({ token: token });       
    } else {
      return res.status(404).json({ message: "Bad Request" });
    }
  })
  .catch(error => {
    return res.status(500).json(error)
  })
}


async function editUser(req, res) {
  const edited_user = setEditedUserFields(req.body);

  return USERModel.findOneAndUpdate({username: req.params.username}, edited_user, { useFindAndModify: false, runValidators: true })
  .then(response => {
    if (!response) return res.status(404).json({ message: "Page Not Found" });
    return getUserByUsername(req, res);
  })
  .catch(error => {
    return res.status(400).json(error);
  })
}


async function deleteUser(req, res) {
  const username = req.params.username;

  return USERModel.findOne({ username: username })
  .then(response => {
    if (!response) return res.status(404).json({ message: "Page Not Found" });

    response.postsId.forEach(async id => {
      return POSTModel.deleteOne({_id: id})
      .catch(error => {
        return res.status(500).json(error);
      })
    })
    
    return USERModel.deleteOne({username: username})
    .then(() => {
      return getUsers(req, res);
    })
    .catch(error => {
      return res.status(500).json(error);
    })
  })
  .catch(error => {
    return res.status(500).json(error);
  })
}



/** 
 *  Auxiliar functions
 */

function setEditedUserFields(req_body) {
  const edited_user = {};

  if (req_body.email !== undefined) {
    edited_user.email = req_body.email;
  }

  if (req_body.password !== undefined) {
    edited_user.password = bcrypt.hashSync(req_body.password, 10);
  }

  if (req_body.name !== undefined) {
    edited_user.name = req_body.name;
  }

  if (req_body.country !== undefined) {
    edited_user.country = req_body.country;
  }

  if (req_body.bornDate !== undefined) {
    edited_user.bornDate = req_body.bornDate;
  }

  if (req_body.photoUrl !== undefined) {
    edited_user.photoUrl = req_body.photoUrl;
  }

  if (req_body.gameList !== undefined) {
    edited_user.gameList = req_body.gameList;
  }

  if (req_body.linkList !== undefined) {
    edited_user.linkList = req_body.linkList;
  }

  if (req_body.biography !== undefined) {
    edited_user.biography = req_body.biography;
  }

  return edited_user;
}