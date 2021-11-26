const utils = require("./modules/Utils");
const DBManager = require("./modules/DBManager");
const ConnectionManager = require("./modules/ConnectionManager");

const ip = utils.getIP();
const port = 2180;

// Default: false. Set to true when using Electron Builder to build the app.
const portable = false;

let app;
if(portable) {
	app = require("./portableApp");
} else {
	app = require("./app");
}

const server = app.listen(port);

const io = require("socket.io")(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE"]
	},
	maxHttpBufferSize: 8192 * 1024
});

const dbManager = new DBManager("db");

const connectionManager = new ConnectionManager(io, dbManager, 64, 5000);

io.on("connection", socket => {
	socket.handshake.address = utils.IPv4(socket.handshake.address);

	let address = socket.handshake.address;

	if(utils.xssValid(address)) {
		socket.emit("set-ip", socket.handshake.address);
		
		socket.on("random-username", () => {
			socket.emit("random-username", utils.getUsername(connectionManager.clients));
		});

		socket.on("register", data => {
			if(!utils.validUsername(data.username)) {
				socket.emit("username-invalid");
				return;
			}

			if(connectionManager.usernameTaken(data.username)) {
				socket.emit("username-taken");
				return;
			}

			connectionManager.addClient(socket, data.username, data.key);
		});

		socket.on("logout", () => {
			socket.emit("logout");
			connectionManager.removeClient(socket.handshake.address);
		});
	} else {
		socket.emit("notify", { 
			title: "Invalid IP", 
			description: "The provided IP contains invalid characters.", 
			duration: 4000, 
			background: "rgb(230,20,20)",
			color: "rgb(255,255,255)"
		});

		socket.emit("kick");
	}
});

console.log("\x1b[35m", "Started Server: ", "\x1b[4m", "http://" + ip + ":" + server.address().port, "\x1b[0m");