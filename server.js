var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');

var app = express();

app.get('/scrape', function(req, res) {
    // The URL we will scrape from - in our example Anchorman 2.

    //cargar el json con todos los tipos
    var jsonCategoria = JSON.parse(fs.readFileSync('tipos.json', 'utf8'));

    //preparamos el json que contendrá los datos del cliente
    var empresa, categoria, direccion, sictio_web, telefono, email;
    var json = {
        empresa: "",
        categoria: "",
        direccion: "",
        sitio_web: "",
        telefono: "",
        email: ""
    };
    for (var categoria in jsonCategoria) {
        var url = "http://amarillas.emol.com/" + jsonCategoria[0].trim();
        console.log("Buscando en ", url);
        request(url, function(error, response, html) {
            if (!error) {
                //cargamos cherrio para hacer scrapping de la url dada
                var $ = cheerio.load(html);
                console.log(html);
                // buscamos los elementos por clase.
                $('span.contenedor-icon-ficha').each(function(i, element) {
                    var data = $(this);
                    url_empresa = data.children().first().text();
                    console.log("Obteniendo ", url_empresa);
                })
            }
            // To write to the system we will use the built in 'fs' library.
            // In this example we will pass 3 parameters to the writeFile function
            // Parameter 1 :  output.json - this is what the created filename will be called
            // Parameter 2 :  JSON.stringify(json, null, 4) - the data to write,
            //  here we do an extra step by calling JSON.stringify to make our JSON easier to read
            // Parameter 3 :  callback function - a callback function to let us know the status of our
        });
    }
    fs.writeFile('clientes.json', JSON.stringify(json, null, 4), function(err) {
        console.log('Archivo escrito! - revisar archivo clientes.json');
    })
    res.send("revisar archivo clientes.json");
});


app.listen('8081')

console.log("Corriendo en el puerto 8081");
console.log("http://localhost:8081/scrape");

exports = module.exports = app;
