const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");
const app = express();
const credentials = require("./credentials.json");

const client_id = credentials.web.client_id;
const client_secret = credentials.web.client_secret;
const redirect_uris = credentials.web.redirect_uris;
const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
);

const SCOPE = [
    "https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file",
];

app.use(cors({ origin: "http://localhost:3000" }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get("/", (req, res) => res.send(" API Running"));

app.get("/getAuthURL", (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPE,
    });
    //console.log(authUrl);
    return res.send(authUrl);
});

app.post("/getToken", (req, res) => {
    if (req.body.code == null) return res.status(400).send("Invalid Request");
    oAuth2Client.getToken(req.body.code, (err, token) => {
        if (err) {
            console.error("Error retrieving access token", err);
            return res.status(400).send("Error retrieving access token");
        }
        res.send(token);
    });
});

app.post("/getUserInfo", (req, res) => {
    if (req.body.token == null) return res.status(400).send("Token not found");
    oAuth2Client.setCredentials(req.body.token);
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });

    oauth2.userinfo.get((err, response) => {
        if (err) res.status(400).send(err);
        //console.log(response.data);
        res.send(response.data);
    });
});

app.post("/getCount", async (req, res) => {
    if (req.body.token == null) return res.status(400).send("Token not found");
    oAuth2Client.setCredentials(req.body.token);
    //const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const response = await drive.files.list({
        q: 'visibility = "anyoneWithLink" and trashed = false',
        fields: "nextPageToken, files(id, name)",
    });
    //console.log(response.data.files);
    res.send({ count: response.data.files.length });
});

app.post("/getPublicFiles", async (req, res) => {
    if (req.body.token == null) return res.status(400).send("Token not found");
    oAuth2Client.setCredentials(req.body.token);
    //const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const response = await drive.files.list({
        q: 'visibility = "anyoneWithLink" and trashed = false',
        fields: "nextPageToken, files(id, name, sharedWithMeTime, createdTime, owners(emailAddress, displayName), permissions(role, type, emailAddress, domain, allowFileDiscovery))",
    });
    //console.log(response.data.files);
    const publicFilesInfo = response.data.files.map((file) => {
        //let accessSetting = "";
        let sharedWith = [];
        if (file?.permissions?.length >= 1) {
            //accessSetting = file.permissions[0].role;
            sharedWith = file.permissions.map(
                (permission) => permission.emailAddress || permission.domain
            );
        }
        //console.log(accessSetting);

        const createdBy =
            file.owners[0].emailAddress || file.owners[0].displayName;
        return {
            name: file.name,
            //accessSetting,
            sharedWith,
            createdBy,
        };
    });
    //console.log(response.data.files);
    res.send({ publicFilesInfo });
});
//start server
const PORT = 8000;
app.listen(PORT, () => console.log(`Server Started ${PORT}`));

/*
const { google } = require('googleapis');

async function getPublicFilesInfo() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: 'visibility = "anyoneWithLink" and trashed = false',
    fields: 'nextPageToken, files(id, name, sharedWithMeTime, createdTime, owners(emailAddress, displayName), permissions(role, type, emailAddress, domain, allowFileDiscovery))',
  });

  const publicFilesInfo = response.data.files.map(file => {
    const accessSetting = file.permissions[0].role;
    const sharedWith = file.permissions.map(permission => permission.emailAddress || permission.domain);
    const createdBy = file.owners[0].emailAddress || file.owners[0].displayName;
    return {
      name: file.name,
      accessSetting,
      sharedWith,
      createdBy,
    };
  });

  return publicFilesInfo;
}

getPublicFilesInfo()
  .then(files => console.log(files))
  .catch(err => console.error('Error getting public files info', err));
*/
