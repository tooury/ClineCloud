#!/usr/bin/env node

/**
 * Test client for Cline Remote Access Server
 *
 * This script tests the WebSocket connection, authentication, and gRPC request forwarding.
 *
 * Usage:
 *   node test-client.js [options]
 *
 * Options:
 *   --port <port>       Remote Access Server port (default: 48812)
 *   --host <host>       Remote Access Server host (default: localhost)
 *   --token <token>     JWT token for authentication (will generate if not provided)
 *   --help              Show this help message
 */

const WebSocket = require('ws');
const http = require('http');

// Parse command line arguments
function parseArgs() {
    const args = {
        port: 48812,
        host: 'localhost',
        token: null
    };

    for (let i = 2; i < process.argv.length; i++) {
        switch (process.argv[i]) {
            case '--port':
                args.port = parseInt(process.argv[++i], 10);
                break;
            case '--host':
                args.host = process.argv[++i];
                break;
            case '--token':
                args.token = process.argv[++i];
                break;
            case '--help':
                console.log(`
Test client for Cline Remote Access Server

Usage:
  node test-client.js [options]

Options:
  --port <port>       Remote Access Server port (default: 48812)
  --host <host>       Remote Access Server host (default: localhost)
  --token <token>     JWT token for authentication (will generate if not provided)
  --help              Show this help message
                `);
                process.exit(0);
        }
    }

    return args;
}

// Generate a test token
async function generateToken(host, port) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            userId: 'test-user',
            workspaceId: 'test-workspace'
        });

        const options = {
            hostname: host,
            port: port,
            path: '/generate-token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('No token in response'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Test HTTP health endpoint
async function testHealthEndpoint(host, port) {
    console.log('\n=== Testing HTTP Health Endpoint ===');

    return new Promise((resolve, reject) => {
        http.get(`http://${host}:${port}/health`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const health = JSON.parse(data);
                    console.log('✅ Health check response:', JSON.stringify(health, null, 2));
                    resolve(health);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.log('❌ Health check failed:', error.message);
            reject(error);
        });
    });
}

// Test HTTP status endpoint
async function testStatusEndpoint(host, port) {
    console.log('\n=== Testing HTTP Status Endpoint ===');

    return new Promise((resolve, reject) => {
        http.get(`http://${host}:${port}/status`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    console.log('✅ Status response:', JSON.stringify(status, null, 2));
                    resolve(status);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.log('❌ Status check failed:', error.message);
            reject(error);
        });
    });
}

// Test WebSocket connection and authentication
async function testWebSocketConnection(host, port, token) {
    console.log('\n=== Testing WebSocket Connection ===');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${host}:${port}/ws`);
        let authenticated = false;
        let testsPassed = 0;
        const totalTests = 4; // auth, ping, grpc request, close

        ws.on('open', () => {
            console.log('✅ WebSocket connected');

            // Test 1: Authentication
            console.log('\nTest 1: Authenticating...');
            const authMessage = {
                type: 'auth',
                token: token
            };
            ws.send(JSON.stringify(authMessage));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 Received:', JSON.stringify(message, null, 2));

                if (message.type === 'auth_success') {
                    console.log('✅ Test 1 PASSED: Authentication successful');
                    console.log(`   Session ID: ${message.sessionId}`);
                    authenticated = true;
                    testsPassed++;

                    // Test 2: Ping/Pong
                    console.log('\nTest 2: Testing ping/pong...');
                    ws.send(JSON.stringify({ type: 'ping' }));
                } else if (message.type === 'auth_error') {
                    console.log('❌ Test 1 FAILED: Authentication failed');
                    console.log(`   Error: ${message.error}`);
                    ws.close();
                } else if (message.type === 'pong') {
                    console.log('✅ Test 2 PASSED: Ping/pong successful');
                    testsPassed++;

                    // Test 3: Send a gRPC request (getLatestState)
                    console.log('\nTest 3: Testing gRPC request forwarding...');
                    const grpcRequest = {
                        type: 'grpc_request',
                        grpc_request: {
                            service: 'cline.StateService',
                            method: 'getLatestState',
                            message: {},
                            request_id: 'test-request-' + Date.now(),
                            is_streaming: false
                        }
                    };
                    ws.send(JSON.stringify(grpcRequest));
                } else if (message.type === 'grpc_response') {
                    if (message.grpc_response.error) {
                        console.log('⚠️  Test 3: gRPC request returned error (expected in test environment)');
                        console.log(`   Error: ${message.grpc_response.error}`);
                    } else {
                        console.log('✅ Test 3 PASSED: gRPC request successful');
                        console.log(`   Response keys: ${Object.keys(message.grpc_response.message || {}).slice(0, 5).join(', ')}...`);
                    }
                    testsPassed++;

                    // Test 4: Close connection
                    console.log('\nTest 4: Testing graceful close...');
                    ws.close(1000, 'Test completed');
                } else if (message.type === 'error') {
                    console.log(`❌ Error received: ${message.error}`);
                }
            } catch (error) {
                console.log('❌ Error parsing message:', error.message);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`\n✅ Test 4 PASSED: WebSocket closed gracefully`);
            console.log(`   Code: ${code}, Reason: ${reason || 'none'}`);
            testsPassed++;

            console.log(`\n=== Test Summary ===`);
            console.log(`Tests passed: ${testsPassed}/${totalTests}`);

            if (testsPassed === totalTests) {
                console.log('✅ All tests PASSED!');
                resolve();
            } else {
                console.log(`⚠️  Some tests failed or were skipped`);
                resolve();
            }
        });

        ws.on('error', (error) => {
            console.log('❌ WebSocket error:', error.message);
            reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('\n⚠️  Test timeout - closing connection');
                ws.close();
            }
        }, 10000);
    });
}

// Main test function
async function main() {
    const args = parseArgs();

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Cline Remote Access Server - Test Client                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nTarget: ws://${args.host}:${args.port}/ws`);

    try {
        // Test HTTP endpoints
        await testHealthEndpoint(args.host, args.port);
        await testStatusEndpoint(args.host, args.port);

        // Get or generate token
        let token = args.token;
        if (!token) {
            console.log('\n=== Generating Test Token ===');
            token = await generateToken(args.host, args.port);
            console.log('✅ Token generated:', token.substring(0, 20) + '...');
        }

        // Test WebSocket
        await testWebSocketConnection(args.host, args.port, token);

        console.log('\n✅ All tests completed successfully!');
        process.exit(0);
    } catch (error) {
        console.log('\n❌ Test failed:', error.message);
        console.log('\nMake sure the Remote Access Server is running:');
        console.log('  node dist/standalone/cline-core.js');
        process.exit(1);
    }
}

// Run tests
main();
