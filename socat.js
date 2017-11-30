"use strict";
const net = require('net');
const serialport = require('serialport');



function printUsageAndExit(exitCode = 0)
{
    console.log (
`
Usage:  socat.js <connection1> <connection2>
        socat.js <connection1> <connection2> [sniff1]
        socat.js <connection1> <connection2> [sniff1] [sniff2]

"connection1" and "connection2" are specified by a string of the form "type:details".
Below are valid strings for "type" and "details":
    <type>      <details>
    ipclient    host:port
    ipserver    host:port
    serial      portname:baudrate

Options: [sniff1]
Sniffing connection1 and connection2 is possible using the sniff arguments. These
are specified by a string, like the connections, of the form: "conn:type:details".
    <conn>      <type>      <details>
    1           as above    as above
    2
`);
    process.exit(exitCode);
}


function initialize_serialport(serial_in, com_port, baud_rate) {
    console.log("initializing serial port..");
    let serial_port = new serialport(com_port, {baudRate: baud_rate, autoOpen: true}, (err) => {
		if (err) {
			console.log("failed to open serial port");
			console.dir(err);
		}
    });

    serial_port.on("data", (buf) => {
        serial_in = Buffer.concat([serial_in, Buffer.from(buf, "binary")]);
		console.log(`received serial: ${serial_in.length} bytes`);
    });
    serial_port.on("open", () => {
        console.log("serialport open");
    });
    serial_port.on("close", () => {
        console.log("serialport close");
    });
    serial_port.on("error", (err) => {
        console.log("serialport error");
        console.dir(args);
    });
    serial_port.on("disconnect", (err) => {
        console.log("serialport disconnect");
        console.dir(args);
    });

    return serial_port;
}


function initialize_socket(ip_socket, ip_in) {
    console.log("initializing socket..");
    ip_socket = net.Socket();
    ip_socket.setEncoding("binary");
    ip_socket.on("data", (data) => {
        ip_in = Buffer.concat([ip_in, Buffer.from(data, "binary")]);
		console.log(`received IP: ${ip_in.length} bytes`);
    });
    ip_socket.on("connect", () => {
        console.log("socket connect");
    });
    ip_socket.on("close", () => {
        console.log("socket close");
    });
    ip_socket.on("end", () => {
        console.log("socket end");
    });
    ip_socket.on("error", (args) => {
        console.log("socket error");
        console.dir(args);
    });
}


function initialize_server(buffer, host, port) {
    let server_obj = {};
    server_obj["client"] = null;

    let server = new net.createServer((socket) => {
        server_obj["client"] = socket;
        socket.on("data", (data) => {
            buffer = Buffer.concat([buffer, Buffer.from(data, "binary")]);
            console.log(`received IP: ${buffer.length} bytes`);
        });
        socket.on("connect", () => {
            console.log("server socket connect");
        });
        socket.on("close", () => {
            console.log("server socket close");
        });
        socket.on("end", () => {
            console.log("server socket end");
        });
        socket.on("error", (args) => {
            console.log("server socket error");
            console.dir(args);
        });
    });
    server_obj["server"] = server;

    // setup event handling
    server.on("error", (e) => {
        console.log("server encountered error:");
        console.dir(e);
    });
    server.on("listening", () => {
        let connection_deets = JSON.stringify(server.address());
        console.log("Server now listening. Details: " + connection_deets);
    });
    server.on("close", () => {
        console.log("server closing...");
    });

    server.listen({
        host: host,
        port: port,
        exclusive: true,
        backlog: 1
    });

    return server_obj;
}


////////////////////////////////////
////////    Classes
////////////////////////////////////
class Connection {
    constructor() {
        this.buffer = Buffer.alloc(0,0,"binary");
    }
    write(buffer) {}
    resetBuffer() {
        this.buffer = Buffer.alloc(0,0,"binary");
    }
    get hasBytes() {
        return 0 < this.buffer.length;
    }
    get canWrite() { return false; }
}


class IpServerConnection extends Connection {
    constructor(host, port) {
        super();
        let connection = initialize_server(this.buffer, host, port);
        this.server = connection["server"];
        this.connection = null;
    }

    write(buffer) {
        this.connection.write(buffer, "binary");
    }

    get canWrite() {
        if (this.connection == null)
            return false;
        else
            return true;
    }
}


class IpClientConnection extends Connection {
    constructor(host, port) {
        super();
        let connection;
        initialize_socket(connection, this.buffer);
        connection.connect({port: port, host: host});
        this.connection = connection;
    }
    
    get canWrite() {
        if (this.connection == null)
            return false;
        else
            return true;
    }
}


class SerialConnection extends Connection {
    constructor(portname, baudrate) {
        super();
        let connection = initialize_serialport(this.buffer, portname, baudrate);
        this.connection = connection;
    }
}


////////////////////////////////////
////////    app logic
////////////////////////////////////
function createSniffConnection1(args)
{

}


function createSniffConnection2(args)
{

}


function createConnection(connection_type, connection_details)
{
    let connection;
    let detail_arr;

    switch (connection_type)
    {
        case "ipclient":
            detail_arr = connection_details.split(":");
            let clienthost = detail_arr[0];
            let clientport = parseInt(detail_arr[1]);
            connection = new IpClientConnection(clienthost, clientport);
            break;
        case "ipserver":
            detail_arr = connection_details.split(":");
            let serverhost = detail_arr[0];
            let serverport = parseInt(detail_arr[1]);
            connection = new IpServerConnection(serverhost, serverport);
            break;
        case "serial":
            detail_arr = connection_details.split(":");
            let portname = detail_arr[0];
            let baudrate = parseInt(detail_arr[1]);
            connection = new SerialConnection(portname, baudrate);
            break;
        default:
            console.log("Encountered invalid connection type: " + connection_type);
            printUsageAndExit(1);
            break;
    }

    return connection;
}


function argSanityCheck(args)
{
    const connection_types = ["serial", "ipserver", "ipclient"];
    
    if (args.length < 4)
    {
        console.log(`ERROR -- You must have at least 4 arguments. You supplied ${args.length} arguments.`);
        printUsageAndExit(1);
    }

    if (connection_types.indexOf(args[0]) < 0)
    {
        console.log(`ERROR -- Invalid connection type: "${args[0]}"`);
        printUsageAndExit(1);
    }
}


function parseArgsToConnections(args)
{
    argSanityCheck(args);

    let conn1 = createConnection(args[0], args[1]);
    let conn2 = createConnection(args[2], args[3]);
    let sniff1 = createSniffConnection1(args);
    let sniff2 = createSniffConnection2(args);

    return [conn1, conn2, sniff1, sniff2];
}


function mainLoop(conn1, conn2, sniffConn1 = null, sniffConn2 = null)
{
    function loop() {
        if (conn1.hasBytes)
        {
            conn2.write(conn1.bytes);
            conn1.resetBuffer();
        }
        
        if (conn2.hasBytes)
        {
            conn1.write(conn2.bytes);
            conn2.resetBuffer();
        }
    }

    setInterval(loop, 50);
}

////////////////////////////////////
////////    BEGIN
////////////////////////////////////

// parse command line args
let argv = require('minimist')(process.argv.slice(2));
let noArgs = (JSON.stringify(argv) == JSON.stringify({_: []}));
if (noArgs)
{
    console.log("Argument must be provided.\n");
    printUsageAndExit(1);
}
else
{
    let conn_list = parseArgsToConnections(argv._); 
    let conn1 = conn_list[0];
    let conn2 = conn_list[1];

    mainLoop(conn1, conn2);
}