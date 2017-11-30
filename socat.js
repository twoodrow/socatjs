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

Where "connection1" and "connection2" are specified by a string of the form "type:details".
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
		//console.log(`received serial: ${serial_in.length} bytes`);
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


function initialize_socket(host, port, onData, onConnect, onClose) {
    console.log("initializing socket..");
    let ip_socket = net.Socket();
    ip_socket.setEncoding("binary");
    ip_socket.on("data", onData);
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

    return ip_socket;
}


function initialize_server(host, port, onSocket) {
    let server = new net.createServer(onSocket);

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

    return server;
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
        //console.log(`have ${this.buffer.length} bytes`);
        return 0 < this.buffer.length;
    }
    get canWrite() { return false; }

    get bytes() { return this.buffer; }
}


class IpServerConnection extends Connection {
    constructor(host, port) {
        super();
        this.connection = null;
        this.connectionOpen = false;
        let server = initialize_server(host, port, (socket) => {
            this.connection = socket;
            this.connectionOpen = true;
            console.log(`socket opened for ${host}:${port}`);
            socket.on("data", (data) => {
                this.buffer = Buffer.concat([this.buffer, Buffer.from(data, "binary")]);
                //console.log(`received data on ${host}:${port} -- ${this.buffer.length} bytes`);
            });
            socket.on("connect", () => {
                console.log("server socket connect");
                this.connectionOpen = true;
            });
            socket.on("close", () => {
                this.connectionOpen = false;
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
        this.server = server;
    }

    write(buffer) {
        //console.log("attempting server socket write...");
        if (this.connection != null)
            this.connection.write(buffer, "binary");
    }

    get canWrite() {
        /*
        console.log(`SERVER
    connection: ${this.connection}
    connectionOpen: ${this.connectionOpen}`);
    */
        if (this.connection == null || this.connectionOpen == false)
            return false;
        else
            return true;
    }
}


class IpClientConnection extends Connection {
    constructor(host, port) {
        super();
        this.connectionOpen = false;
        let connection = net.Socket();
        connection.setEncoding("binary");
        connection.on("data", (data) => {
            this.buffer = Buffer.concat([this.buffer, Buffer.from(data, "binary")]);
            //console.log(`received data on ${host}:${port} -- ${this.buffer.length} bytes`);
        });
        connection.on("connect", () => {
            console.log("socket connect");
            this.connectionOpen = true;
        });
        connection.on("close", () => {
            console.log("socket close");
            this.connectionOpen = false;
        });
        connection.on("end", () => {
            console.log("socket end");
        });
        connection.on("error", (args) => {
            console.log("socket error");
            console.dir(args);
        });

        connection.connect({port: port, host: host});
        this.connection = connection;
    }
    
    get canWrite() {
        /*
        console.log(`CLIENT
    connection: ${this.connection}
    connectionOpen: ${this.connectionOpen}`);
    */
        if (this.connection == null || this.connectionOpen == false)
            return false;
        else
            return true;
    }

    write(buffer) {
        //console.log("attempting client socket write...");
        this.connection.write(buffer, "binary");
    }
}


class SerialConnection extends Connection {
    constructor(portname, baudrate) {
        super();
        let connection = initialize_serialport(this.buffer, portname, baudrate);
        this.connection = connection;
    }

    get canWrite() {
        return true;
    }
}


////////////////////////////////////
////////    app logic
////////////////////////////////////
function createSniffConnection1(args)
{
    //console.log(`sniff1 args: ${JSON.stringify(args)}`);

    let connection = createSniffConnection(args, 1);
    //console.log(`connection1 is: ${connection}`);
    return connection;
}


function createSniffConnection2(args)
{
    //console.log(`sniff2 args: ${JSON.stringify(args)}`);

    let connection = createSniffConnection(args, 2);
    //console.log(`connection2 is: ${connection}`);
    return connection;
}


function createSniffConnection(args, connection_num)
{
    let L = args.length;
    for (let i = 0; i < L; i++)
    {
        let arg_arr = args[i].split(":");
        if (arg_arr[0] == connection_num)
            return createConnection(args[i].slice(2));
    }

    return null;
}


function createConnection(connection_argument)
{
    let args = connection_argument.split(":");
    let connection_type = args[0];
    let detail_arr = args.slice(1);

    //console.log(`createConnection arg: ${connection_argument}`)

    let connection;

    switch (connection_type)
    {
        case "ipclient":
            let clienthost = detail_arr[0];
            let clientport = parseInt(detail_arr[1]);
            connection = new IpClientConnection(clienthost, clientport);
            break;
        case "ipserver":
            let serverhost = detail_arr[0];
            let serverport = parseInt(detail_arr[1]);
            connection = new IpServerConnection(serverhost, serverport);
            break;
        case "serial":
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
    //console.log(`Arguments provided: ${JSON.stringify(args)}`);
    
    if (args.length < 2)
    {
        console.log(`ERROR -- You must have at least 2 arguments. You supplied ${args.length} arguments.`);
        printUsageAndExit(1);
    }

    // get individual information
    let arg0 = args[0].split(":");
    let arg1 = args[1].split(":");

    //console.log(`arg0 was: ${JSON.stringify(arg0)}`);

    if (connection_types.indexOf(arg0[0]) < 0)
    {
        console.log(`ERROR -- Invalid connection type: "${arg0[0]}"`);
        printUsageAndExit(1);
    }
    
    if (connection_types.indexOf(arg1[0]) < 0)
    {
        console.log(`ERROR -- Invalid connection type: "${arg1[0]}"`);
        printUsageAndExit(1);
    }

    // check no IP port collisions
    // check no serial port collisions
    // check sniff connections have correct numerals
}


function parseArgsToConnections(args)
{
    argSanityCheck(args);

    let conn1 = createConnection(args[0]);
    let conn2 = createConnection(args[1]);
    let sniff1 = createSniffConnection1(args.slice(2));
    let sniff2 = createSniffConnection2(args.slice(2));

    return [conn1, conn2, sniff1, sniff2];
}


function mainLoop(conn1, conn2, sniffConn1, sniffConn2)
{
    function loop() {
        if (conn1.hasBytes && conn2.canWrite)
        {
            //console.log("conn1 has bytes!");
            conn2.write(conn1.bytes);

            if (sniffConn1 != null)
            {
                if (sniffConn1.canWrite)
                {
                    //console.log(`wring to sniffer1`);
                    sniffConn1.write(conn1.bytes);
                }
            }

            conn1.resetBuffer();
        }
        
        if (conn2.hasBytes && conn1.canWrite)
        {
            //console.log("conn2 has bytes!");
            conn1.write(conn2.bytes);
            
            if (sniffConn2 != null)
            {
                if (sniffConn2.canWrite)
                {
                    //console.log(`wring to sniffer2`);
                    sniffConn2.write(conn2.bytes);
                }
            }

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
    console.log("ERROR -- Arguments must be provided.");
    printUsageAndExit(1);
}
else
{
    let conn_list = parseArgsToConnections(argv._);

    let conn1 = conn_list[0];
    let conn2 = conn_list[1];
    let sniff1 = conn_list[2];
    let sniff2 = conn_list[3];
    
    //console.dir(conn_list);

    mainLoop(conn1, conn2, sniff1, sniff2);
}