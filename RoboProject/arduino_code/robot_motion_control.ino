/*
 * ============================================================
 *  Robot Motion Control using L298N Motor Driver
 * ============================================================
 *  
 *  Description:
 *    This program controls a two-wheeled robot using an
 *    L298N motor driver. The robot moves in 4 directions:
 *    Forward, Backward, Left, and Right.
 *
 *  How it works:
 *    - The L298N has 4 input pins (IN1, IN2, IN3, IN4)
 *    - IN1 & IN2 control the LEFT motor direction
 *    - IN3 & IN4 control the RIGHT motor direction
 *    - Setting one pin HIGH and the other LOW makes
 *      the motor spin in one direction
 *    - Reversing the HIGH/LOW makes it spin the other way
 *
 *  Pin Connections:
 *    Arduino Pin 8  → L298N IN1 (Left Motor)
 *    Arduino Pin 9  → L298N IN2 (Left Motor)
 *    Arduino Pin 10 → L298N IN3 (Right Motor)
 *    Arduino Pin 11 → L298N IN4 (Right Motor)
 *
 * ============================================================
 */

// ── Pin Definitions ──
// Left Motor (Motor A)
int IN1 = 8;   // Left motor direction pin 1
int IN2 = 9;   // Left motor direction pin 2

// Right Motor (Motor B)
int IN3 = 10;  // Right motor direction pin 1
int IN4 = 11;  // Right motor direction pin 2


// ── setup() runs once when Arduino powers on ──
// We set all motor pins as OUTPUT so we can send signals to them
void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
}


// ── loop() runs repeatedly forever ──
// The robot performs a demo sequence: Forward → Stop → Backward →
// Stop → Left → Stop → Right → Stop, then repeats
void loop() {
  forward();          // Move forward
  delay(2000);        // ...for 2 seconds

  stopRobot();        // Stop
  delay(1000);        // ...for 1 second

  backward();         // Move backward
  delay(2000);        // ...for 2 seconds

  stopRobot();        // Stop
  delay(1000);        // ...for 1 second

  left();             // Turn left
  delay(2000);        // ...for 2 seconds

  stopRobot();        // Stop
  delay(1000);        // ...for 1 second

  right();            // Turn right
  delay(2000);        // ...for 2 seconds

  stopRobot();        // Stop
  delay(3000);        // ...for 3 seconds (longer pause before repeating)
}


// ============================================================
//  Movement Functions
// ============================================================

/*
 * forward() - Move the robot straight ahead
 *
 * How: Both motors spin in the FORWARD direction.
 *   Left Motor:  IN1 = HIGH, IN2 = LOW  → spins forward
 *   Right Motor: IN3 = HIGH, IN4 = LOW  → spins forward
 *
 * Result: Robot moves forward in a straight line.
 */
void forward() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}


/*
 * backward() - Move the robot straight back
 *
 * How: Both motors spin in the BACKWARD direction.
 *   Left Motor:  IN1 = LOW, IN2 = HIGH  → spins backward
 *   Right Motor: IN3 = LOW, IN4 = HIGH  → spins backward
 *
 * Result: Robot moves backward in a straight line.
 */
void backward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}


/*
 * left() - Turn the robot to the left
 *
 * How: The two motors spin in OPPOSITE directions.
 *   Left Motor:  IN1 = LOW, IN2 = HIGH  → spins backward
 *   Right Motor: IN3 = HIGH, IN4 = LOW  → spins forward
 *
 * Result: The left wheel goes back and the right wheel goes
 *         forward, so the robot pivots (turns) to the left.
 */
void left() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}


/*
 * right() - Turn the robot to the right
 *
 * How: The two motors spin in OPPOSITE directions.
 *   Left Motor:  IN1 = HIGH, IN2 = LOW  → spins forward
 *   Right Motor: IN3 = LOW, IN4 = HIGH  → spins backward
 *
 * Result: The left wheel goes forward and the right wheel goes
 *         back, so the robot pivots (turns) to the right.
 */
void right() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}


/*
 * stopRobot() - Stop all motors
 *
 * How: Set ALL motor pins to LOW.
 *   Left Motor:  IN1 = LOW, IN2 = LOW  → no current → stopped
 *   Right Motor: IN3 = LOW, IN4 = LOW  → no current → stopped
 *
 * Result: Both motors stop and the robot stands still.
 */
void stopRobot() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}
