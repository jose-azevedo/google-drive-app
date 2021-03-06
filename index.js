const {google} = require('googleapis');
const express = require('express');
// @TODO remover comentário ao usar localmente
//require('dotenv').config()

const app = express();
app.use(express.json()) 

const client_secret = process.env.CLIENT_SECRET;
const client_id = process.env.CLIENT_ID;
const redirect_uris = [process.env.REDIRECT_URIS];

const token = {
    access_token: process.env.ACCESS_TOKEN,
    refresh_token: process.env.REFRESH_TOKEN,
    scope: process.env.SCOPE,
    token_type: process.env.TOKEN_TYPE,
    expiry_date: process.env.EXPIRY_DATE
}

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
oAuth2Client.setCredentials(token);

app.get('/', (req, res) => {
  res.status(200).end();
});

app.get('/google/auth', (req, res) => {
  res.send(`Authorization code: ${req.query.code}`);
});

app.post('/upload', (req, res) => {
  searchFile(oAuth2Client, req.body);
  res.status(200).end();
});
var port = process.env.PORT || 5000;
var server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

function searchFile(auth, body) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    q: `name='${body.name}'`,
    pageSize: 40,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    var files = res.data.files.map((file) => {return file.name});
    var ids = res.data.files.map((file) => {return file.id});
    if(files.indexOf(body.name) > -1) {
      console.log('Arquivo de medição encontrado. Atualizando arquivo!\n');
      var id = ids[files.indexOf(body.name)];
      updateData(auth, id, body.name, body.data);
    } else {
      console.log('Arquivo de medição não encontrado. Criando um novo arquivo!\n');
      createFile(auth, body.name, body.data)
    }
  });
}

function updateData(auth, id, filename, filedata) {
  const sheets = google.sheets({version: 'v4', auth});
  console.log(`Arquivo: ${filename}`);
  console.log(`ID: ${id}`);
  console.log(`Dados a inserir: ${filedata}`);

  var values = parseRequestBody(filedata)
  const resource = {
    values,
  };
  sheets.spreadsheets.values.append ({
    spreadsheetId: id,
    range: 'A1:J1',
    resource,
    valueInputOption: 'USER_ENTERED'
  }, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Arquivo atualizado: ${filename}\n`);
    }
  });
}

function createFile(auth, filename, filedata) {
  const drive = google.drive({version: 'v3', auth});
  var fileMetadata = {
    'name': filename,
    'mimeType': 'application/vnd.google-apps.spreadsheet'
  };
  var media = {
    mimeType: 'text/csv'
  };
  drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      // Handle error
      console.error(err);
    } else {
      console.log(`Arquivo criado com sucesso! Id: ${file.data.id}`);
      updateData(auth, file.data.id, filename, filedata)
    }
  });
}

function parseRequestBody(rawFileData) {
  var data = rawFileData.split(';');
  var linesToAppend = [];
  if (data.length > 10) {
    linesToAppend = [data.slice(0, 10), data.slice(10)];
  } else {
    linesToAppend = [data];
  }
  return linesToAppend;
}