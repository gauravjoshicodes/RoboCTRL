"""
============================================================
 Project: Robot Motion Control with Obstacle Avoidance
 Author:  Internship Project
 Date:    April 2026
 Platform: Raspberry Pi
 Driver:   L298N Motor Driver
 Sensor:   HC-SR04 Ultrasonic Distance Sensor
============================================================

 Description:
   Enhanced robot that autonomously avoids obstacles using
   an HC-SR04 ultrasonic sensor. When an obstacle is detected
   within a threshold distance, the robot stops, backs up,
   and turns to find a clear path.

 Additional GPIO Pins for HC-SR04:
   TRIG → GPIO 5   (Trigger pulse output)
   ECHO → GPIO 6   (Echo pulse input)

 Requirements:
   pip install RPi.GPIO

============================================================
"""

try:
    import RPi.GPIO as GPIO
except (ImportError, RuntimeError):
    # Running on a non-Raspberry Pi platform (e.g. Windows / macOS).
    # gpio_mock provides a console-logging stub so the code runs without hardware.
    import gpio_mock as GPIO
    print("[WARN] RPi.GPIO not found – using GPIO mock (no real hardware).")
import time

# ──────────────────────────────────────────────
#  Motor Pin Configuration (same as base project)
# ──────────────────────────────────────────────

ENA = 25
IN1 = 17
IN2 = 27
IN3 = 22
IN4 = 23
ENB = 24

# ──────────────────────────────────────────────
#  Ultrasonic Sensor Pin Configuration
# ──────────────────────────────────────────────

TRIG = 5    # Trigger pin (sends ultrasonic pulse)
ECHO = 6    # Echo pin (receives reflected pulse)

# ──────────────────────────────────────────────
#  Constants
# ──────────────────────────────────────────────

OBSTACLE_THRESHOLD = 25.0    # Distance threshold in cm
SPEED = 70                   # Motor speed (duty cycle %)
TURN_DURATION = 0.8          # Duration of avoidance turn (seconds)
BACKUP_DURATION = 0.5        # Duration of backup (seconds)
PWM_FREQ = 1000              # PWM frequency in Hz


class ObstacleAvoidingRobot:
    """
    Autonomous robot with ultrasonic obstacle avoidance.
    
    The robot continuously moves forward, measuring distance
    to obstacles ahead. When an obstacle is detected within
    the threshold distance, it executes an avoidance maneuver:
    1. Stop
    2. Back up briefly
    3. Turn right to find a clear path
    4. Resume forward movement
    """

    def __init__(self):
        """Initialize GPIO, motor PWM, and ultrasonic sensor."""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)

        # Motor pins
        for pin in [ENA, IN1, IN2, ENB, IN3, IN4]:
            GPIO.setup(pin, GPIO.OUT)

        # Ultrasonic sensor pins
        GPIO.setup(TRIG, GPIO.OUT)
        GPIO.setup(ECHO, GPIO.IN)

        # PWM setup
        self.pwm_a = GPIO.PWM(ENA, PWM_FREQ)
        self.pwm_b = GPIO.PWM(ENB, PWM_FREQ)
        self.pwm_a.start(0)
        self.pwm_b.start(0)

        # Ensure trigger is LOW initially
        GPIO.output(TRIG, False)
        time.sleep(0.5)  # Let sensor settle

        print("[INIT] Obstacle Avoiding Robot ready.")
        print(f"[INIT] Obstacle threshold: {OBSTACLE_THRESHOLD} cm")

    def measure_distance(self):
        """
        Measure distance using HC-SR04 ultrasonic sensor.
        
        How it works:
        1. Send a 10μs HIGH pulse on TRIG pin
        2. Sensor emits ultrasonic burst
        3. Measure duration of HIGH pulse on ECHO pin
        4. Calculate distance: distance = (time × speed_of_sound) / 2
        
        Returns:
            float: Distance to nearest object in centimeters.
        """
        # Send trigger pulse (10 microseconds)
        GPIO.output(TRIG, True)
        time.sleep(0.00001)  # 10μs
        GPIO.output(TRIG, False)

        # Wait for echo to start (rising edge)
        pulse_start = time.time()
        timeout_start = pulse_start

        while GPIO.input(ECHO) == 0:
            pulse_start = time.time()
            # Timeout after 0.1 seconds
            if pulse_start - timeout_start > 0.1:
                return 999.0  # No echo received

        # Wait for echo to end (falling edge)
        pulse_end = time.time()
        timeout_end = pulse_end

        while GPIO.input(ECHO) == 1:
            pulse_end = time.time()
            if pulse_end - timeout_end > 0.1:
                return 999.0

        # Calculate distance
        # Speed of sound = 34300 cm/s
        # Distance = (time × speed) / 2  (divide by 2 for round trip)
        pulse_duration = pulse_end - pulse_start
        distance = (pulse_duration * 34300) / 2

        return round(distance, 2)

    def move_forward(self):
        """Move both motors forward."""
        self.pwm_a.ChangeDutyCycle(SPEED)
        self.pwm_b.ChangeDutyCycle(SPEED)
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.HIGH)
        GPIO.output(IN4, GPIO.LOW)

    def move_backward(self):
        """Move both motors backward."""
        self.pwm_a.ChangeDutyCycle(SPEED)
        self.pwm_b.ChangeDutyCycle(SPEED)
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.HIGH)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

    def turn_right(self):
        """Pivot turn to the right."""
        self.pwm_a.ChangeDutyCycle(SPEED)
        self.pwm_b.ChangeDutyCycle(SPEED)
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

    def stop(self):
        """Stop all motors."""
        self.pwm_a.ChangeDutyCycle(0)
        self.pwm_b.ChangeDutyCycle(0)
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.LOW)

    def avoid_obstacle(self):
        """
        Execute obstacle avoidance maneuver:
        1. Stop immediately
        2. Back up for a short duration
        3. Turn right to find clear path
        """
        print("  [AVOID] Obstacle detected! Executing avoidance...")

        # Step 1: Stop
        self.stop()
        time.sleep(0.3)

        # Step 2: Back up
        print("  [AVOID] Backing up...")
        self.move_backward()
        time.sleep(BACKUP_DURATION)
        self.stop()
        time.sleep(0.3)

        # Step 3: Turn right
        print("  [AVOID] Turning right...")
        self.turn_right()
        time.sleep(TURN_DURATION)
        self.stop()
        time.sleep(0.3)

        print("  [AVOID] Avoidance complete. Resuming forward.")

    def run(self):
        """
        Main autonomous navigation loop.
        
        Continuously measures distance and adjusts behavior:
        - If clear path: move forward
        - If obstacle detected: execute avoidance maneuver
        """
        print("\n[RUN] Starting autonomous navigation...")
        print("[RUN] Press Ctrl+C to stop.\n")

        try:
            while True:
                # Measure distance to nearest obstacle
                distance = self.measure_distance()
                print(f"  [SENSOR] Distance: {distance} cm", end="")

                if distance < OBSTACLE_THRESHOLD:
                    # Obstacle detected!
                    print(" ⚠ OBSTACLE!")
                    self.avoid_obstacle()
                else:
                    # Path is clear, move forward
                    print(" ✓ Clear")
                    self.move_forward()

                # Small delay between measurements
                time.sleep(0.1)

        except KeyboardInterrupt:
            print("\n\n[EXIT] Navigation stopped by user.")

        finally:
            self.stop()
            self.pwm_a.stop()
            self.pwm_b.stop()
            GPIO.cleanup()
            print("[CLEANUP] GPIO resources released.")


# ──────────────────────────────────────────────
#  Main Entry Point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    robot = ObstacleAvoidingRobot()
    robot.run()
