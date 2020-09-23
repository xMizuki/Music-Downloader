//Configuration file
const config = require('./config.json');

//Librairies
const data = require('quick.db');
const express = require('express');
const player = require('url-song-utilities');

//New express() application
const app = express();

//Configuration of the application
app.use(express.static("style"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Index page
app.get("/", async (req, res) => { return res.render("index", { error: null }) });

//Elements of the 'index' page
app.post("/", async (req, res) => {
    let video = req.body.video;
    let type = req.body.type || "play";
    if (!video) newIndexError(res)
    return await downloadVideo(video, type.toLowerCase(), res);
});

//If a page is filled in but not found
app.get("*", (req, res) => { return res.redirect("/") });

//Function downloadVideo()
async function downloadVideo(video, type, res) {
    //If no video is received
    if (!video) return;
    //Search
    let searchResult = await searchSong(video, res);
    //If the client is enabled in the configuration file, a 'logs' message will be sent to the configured Webhook
    if (config.client) {
        const discord = require('discord.js');
        const client = new discord.Client();
        client.statusHook = new discord.WebhookClient(config.webhookID, config.webhookPassword);
        try { client.statusHook.send(`New request : **${searchResult.title}** (type : __${type}__) 🔔`) } catch (e) { return };
    }
    //If the type is 'play'
    if (type === "play") {
        try {
            //Link transformation
            let url = await player.toPlayableLink(searchResult.url);
            if (!url) newIndexError(res);
            //Recovering number of downloads
            let number = data.get(searchResult.id);
            if (number === null) number = 0;
            //Returning information
            return res.render("player", { data: searchResult, stream: url, duration: formatTime(searchResult.duration), downloads: number });
        } catch (e) { newIndexError(res) };
    }
    //Download
    var dataTypes = ['mp3', 'mp4', 'mov', 'avi', 'flv', 'mkv'];
    //If the type provided is not correct
    if (!dataTypes.includes(type)) {
        newPlayerError(res);
    } else {
        //Add download
        addDownload(searchResult.id);
        //Returning the file
        await player.download(searchResult.url).then(stream => {
            res.attachment(`${searchResult.title}.${type}`);
            return stream.pipe(res);
        });
    }
}

//When the application is 'ready' a message is returned
app.listen(config.port, () => console.log(`Server started (port ${config.port}) !`));

//Function newIndexError()
async function newIndexError(res) { return res.render("index", { error: "Couldn't find the video !" }) }

//Function newPlayerError()
async function newPlayerError(res) { return res.render("index", { error: "An error occurred with the download type !" }) }

//Function addDownload()
async function addDownload(song) { data.add(song, 1) }

//Function searchSong()
async function searchSong(video, res) {
    try {
        var searchResult = await player.searchSong(video);
        return searchResult;
    } catch (e) { newIndexError(res) };
}

//Function formatTime()
function formatTime(seconds) {
    var time = [], s = 1;
    var calc = seconds;

    calc = ((calc - (time[time.length - 1] || 0)) * s) / 60;
    time.push(format(Math.floor(calc)));

    calc = (calc - (time[time.length - 1])) * 60;
    time.push(format(Math.round(calc)));

    function format(n) {
        return (("" + n) / 10).toFixed(1).replace(".", "");
    }

    return time.join(":");
};