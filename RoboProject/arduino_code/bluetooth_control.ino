/*
 * ============================================================
 *  Project: Robot Motion Control via Bluetooth (HC-05)
 *  Author:  Internship Project
 *  Date:    April 2026
 *  Board:   Arduino Uno / Mega
 *  Driver:  L298N Dual H-Bridge Motor Driver
 *  Module:  HC-05 Bluetooth Module
 * ============================================================
 *
 *  Description:
 *    Enhanced version of the robot motion control project.
 *    The robot is controlled wirelessly via Bluetooth using
 *    a smartphone app (e.g., "Arduino Bluetooth Controller").
 *
 *  Bluetooth Commands:
 *    'F' → Move Forward
 *    'B' → Move Backward
 *    'L' → Turn Left
 *    'R' → Turn Right
 *    'S' → Stop
 *    '+' → Increase Speed
 *    '-' → Decrease Speed
 *
 *  HC-05 Wiring:
 *    HC-05 TX  → Arduino Pin 2 (SoftwareSerial RX)
 *    HC-05 RX  → Arduino Pin 3 (SoftwareSerial TX)
 *    HC-05 VCC → Arduino 5V
 *    HC-05 GND → Arduino GND
 * ============================================================
 */

#include <SoftwareSerial.h>

// ──────────────────────────────────────────────
//  Bluetooth Serial Setup
// ──────────────────────────────────────────────

// Pin 2 = RX (receives from HC-05 TX)
// Pin 3 = TX (sends to HC-05 RX)
SoftwareSerial bluetooth(2, 3);

// ──────────────────────────────────────────────
//  Motor Pin Definitions
// ──────────────────────────────────────────────

#define ENA  5
#define IN1  8
#define IN2  9
#define IN3  10
#define IN4  11
#define ENB  6

// ──────────────────────────────────────────────
//  Variables
// ──────────────────────────────────────────────

int motorSpeed = 200;         // Current motor speed (0-255)
char command;                 // Incoming Bluetooth command
const int SPEED_STEP = 25;    // Speed increment/decrement step

// ──────────────────────────────────────────────
//  Setup
// ──────────────────────────────────────────────

void setup() {
  // Initialize serial monitors
  Serial.begin(9600);
  bluetooth.begin(9600);

  Serial.println("==========================================");
  Serial.println(" Bluetooth Robot Controller Initialized");
  Serial.println("==========================================");
  Serial.println(" Commands: F/B/L/R/S  Speed: +/-");
  Serial.println();

  // Configure motor pins
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  stopMotors();
}

// ──────────────────────────────────────────────
//  Main Loop - Listen for Bluetooth commands
// ──────────────────────────────────────────────

void loop() {
  // Check if data is available from Bluetooth
  if (bluetooth.available()) {
    command = bluetooth.read();

    // Debug: Print received command
    Serial.print("[BT] Received: ");
    Serial.println(command);

    // Process the command
    switch (command) {
      case 'F':
      case 'f':
        Serial.println(">>> FORWARD");
        moveForward(motorSpeed);
        break;

      case 'B':
      case 'b':
        Serial.println(">>> BACKWARD");
        moveBackward(motorSpeed);
        break;

      case 'L':
      case 'l':
        Serial.println(">>> LEFT TURN");
        turnLeft(motorSpeed);
        break;

      case 'R':
      case 'r':
        Serial.println(">>> RIGHT TURN");
        turnRight(motorSpeed);
        break;

      case 'S':
      case 's':
        Serial.println(">>> STOP");
        stopMotors();
        break;

      case '+':
        // Increase speed (max 255)
        motorSpeed = min(motorSpeed + SPEED_STEP, 255);
        Serial.print("[SPEED] Increased to: ");
        Serial.println(motorSpeed);
        // Update current motor speed
        analogWrite(ENA, motorSpeed);
        analogWrite(ENB, motorSpeed);
        break;

      case '-':
        // Decrease speed (min 0)
        motorSpeed = max(motorSpeed - SPEED_STEP, 0);
        Serial.print("[SPEED] Decreased to: ");
        Serial.println(motorSpeed);
        // Update current motor speed
        analogWrite(ENA, motorSpeed);
        analogWrite(ENB, motorSpeed);
        break;

      default:
        Serial.print("[WARN] Unknown command: ");
        Serial.println(command);
        break;
    }

    // Send acknowledgment back to Bluetooth device
    bluetooth.print("CMD:");
    bluetooth.print(command);
    bluetooth.print(" SPD:");
    bluetooth.println(motorSpeed);
  }
}

// ──────────────────────────────────────────────
//  Motor Control Functions
// ──────────────────────────────────────────────

void moveForward(int speed) {
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void moveBackward(int speed) {
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void turnLeft(int speed) {
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void turnRight(int speed) {
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void stopMotors() {
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}
