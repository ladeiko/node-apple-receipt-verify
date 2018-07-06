'use strict';

const fs = require('fs');
const path = require('path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'),'utf8');
const json = require(path.join(__dirname, '..', 'package.json'));
json.readme = readme;
fs.writeFileSync(path.join(__dirname, '..', 'package.json'), JSON.stringify(json,null,2));
