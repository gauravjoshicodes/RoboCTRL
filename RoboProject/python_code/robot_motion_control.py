"""
============================================================
 Project: Robot Motion Control using Motor Direction
 Author:  Internship Project
 Date:    April 2026
 Platform: Raspberry Pi (any model with GPIO)
 Driver:   L298N Dual H-Bridge Motor Driver
============================================================

 Description:
   This Python script controls a two-wheeled differential
   drive robot using a Raspberry Pi and L298N motor driver.
   The robot moves in four directions: Forward, Backward,
   Left, and Right.

 GPIO Pin Configuration (BCM Mode):
   ENA  → GPIO 25  (PWM speed control for Motor A - Left)
   IN1  → GPIO 17  (Motor A direction pin 1)
   IN2  → GPIO 27  (Motor A direction pin 2)
   IN3  → GPIO 22  (Motor B direction pin 1)
   IN4  → GPIO 23  (Motor B direction pin 2)
   ENB  → GPIO 24  (PWM speed control for Motor B - Right)

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
import sys

# ──────────────────────────────────────────────
#  GPIO Pin Configuration
# ──────────────────────────────────────────────

# Left Motor (Motor A) pins
ENA = 25    # Enable pin for Motor A (PWM speed control)
IN1 = 17    # Motor A input 1
IN2 = 27    # Motor A input 2

# Right Motor (Motor B) pins
ENB = 24    # Enable pin for Motor B (PWM speed control)
IN3 = 22    # Motor B input 1
IN4 = 23    # Motor B input 2

# ──────────────────────────────────────────────
#  Constants
# ──────────────────────────────────────────────

DEFAULT_SPEED = 75      # Default duty cycle (0-100%)
TURN_SPEED = 60         # Turning duty cycle
MOVE_DURATION = 2.0     # Duration of each movement (seconds)
PAUSE_DURATION = 1.0    # Pause between movements (seconds)
PWM_FREQUENCY = 1000    # PWM frequency in Hz


class RobotController:
    """
    A class to control a two-wheeled differential drive robot.
    
    This class encapsulates all motor control logic, providing
    clean methods for each movement direction and speed control.
    """

    def __init__(self):
        """
        Initialize the robot controller.
        - Set up GPIO mode (BCM numbering)
        - Configure all motor pins as outputs
        - Initialize PWM on enable pins for speed control
        """
        print("=" * 50)
        print(" Robot Motion Control System")
        print(" Platform: Raspberry Pi + L298N Driver")
        print("=" * 50)
        print()

        # Use BCM pin numbering (GPIO numbers, not physical pin numbers)
        GPIO.setmode(GPIO.BCM)

        # Suppress GPIO warnings (useful during development)
        GPIO.setwarnings(False)

        # Configure Motor A (Left Motor) pins as output
        GPIO.setup(ENA, GPIO.OUT)
        GPIO.setup(IN1, GPIO.OUT)
        GPIO.setup(IN2, GPIO.OUT)

        # Configure Motor B (Right Motor) pins as output
        GPIO.setup(ENB, GPIO.OUT)
        GPIO.setup(IN3, GPIO.OUT)
        GPIO.setup(IN4, GPIO.OUT)

        # Initialize PWM on enable pins
        # PWM allows us to control motor speed by varying duty cycle
        self.pwm_a = GPIO.PWM(ENA, PWM_FREQUENCY)
        self.pwm_b = GPIO.PWM(ENB, PWM_FREQUENCY)

        # Start PWM with 0% duty cycle (motors off)
        self.pwm_a.start(0)
        self.pwm_b.start(0)

        # Track current speed
        self.current_speed = DEFAULT_SPEED

        print("[INIT] GPIO configured successfully.")
        print(f"[INIT] PWM frequency: {PWM_FREQUENCY} Hz")
        print(f"[INIT] Default speed: {DEFAULT_SPEED}%")
        print()

    def set_speed(self, speed):
        """
        Set the motor speed.
        
        Args:
            speed (int): Duty cycle percentage (0-100)
        """
        self.current_speed = max(0, min(100, speed))
        print(f"  [SPEED] Set to {self.current_speed}%")

    def move_forward(self, speed=None):
        """
        Move the robot forward.
        
        Both motors rotate in the forward direction, causing
        the robot to move straight ahead.
        
        Motor A (Left):  IN1=HIGH, IN2=LOW  → Forward
        Motor B (Right): IN3=HIGH, IN4=LOW  → Forward
        
        Args:
            speed (int, optional): Motor speed (0-100). Uses default if None.
        """
        speed = speed or self.current_speed

        # Set PWM duty cycle for speed control
        self.pwm_a.ChangeDutyCycle(speed)
        self.pwm_b.ChangeDutyCycle(speed)

        # Left motor → Forward
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)

        # Right motor → Forward
        GPIO.output(IN3, GPIO.HIGH)
        GPIO.output(IN4, GPIO.LOW)

        print(f"  [MOVING] Forward at {speed}% speed")

    def move_backward(self, speed=None):
        """
        Move the robot backward.
        
        Both motors rotate in the reverse direction, causing
        the robot to move straight backward.
        
        Motor A (Left):  IN1=LOW, IN2=HIGH → Backward
        Motor B (Right): IN3=LOW, IN4=HIGH → Backward
        
        Args:
            speed (int, optional): Motor speed (0-100). Uses default if None.
        """
        speed = speed or self.current_speed

        self.pwm_a.ChangeDutyCycle(speed)
        self.pwm_b.ChangeDutyCycle(speed)

        # Left motor → Backward
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.HIGH)

        # Right motor → Backward
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

        print(f"  [MOVING] Backward at {speed}% speed")

    def turn_left(self, speed=None):
        """
        Turn the robot to the left.
        
        Left motor rotates backward while right motor rotates
        forward. This creates a pivot turn to the left.
        
        Motor A (Left):  IN1=LOW,  IN2=HIGH → Backward
        Motor B (Right): IN3=HIGH, IN4=LOW  → Forward
        
        Args:
            speed (int, optional): Motor speed (0-100). Uses default if None.
        """
        speed = speed or self.current_speed

        self.pwm_a.ChangeDutyCycle(speed)
        self.pwm_b.ChangeDutyCycle(speed)

        # Left motor → Backward
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.HIGH)

        # Right motor → Forward
        GPIO.output(IN3, GPIO.HIGH)
        GPIO.output(IN4, GPIO.LOW)

        print(f"  [TURNING] Left at {speed}% speed")

    def turn_right(self, speed=None):
        """
        Turn the robot to the right.
        
        Left motor rotates forward while right motor rotates
        backward. This creates a pivot turn to the right.
        
        Motor A (Left):  IN1=HIGH, IN2=LOW  → Forward
        Motor B (Right): IN3=LOW,  IN4=HIGH → Backward
        
        Args:
            speed (int, optional): Motor speed (0-100). Uses default if None.
        """
        speed = speed or self.current_speed

        self.pwm_a.ChangeDutyCycle(speed)
        self.pwm_b.ChangeDutyCycle(speed)

        # Left motor → Forward
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)

        # Right motor → Backward
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

        print(f"  [TURNING] Right at {speed}% speed")

    def stop(self):
        """
        Stop both motors.
        
        Sets all direction pins LOW and duty cycle to 0%.
        """
        self.pwm_a.ChangeDutyCycle(0)
        self.pwm_b.ChangeDutyCycle(0)

        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.LOW)

        print("  [STOPPED] All motors stopped.")

    def cleanup(self):
        """
        Clean up GPIO resources.
        
        This should always be called when the program ends
        to properly release the GPIO pins.
        """
        self.stop()
        self.pwm_a.stop()
        self.pwm_b.stop()
        GPIO.cleanup()
        print("\n[CLEANUP] GPIO resources released.")


def demo_sequence(robot):
    """
    Run a demonstration sequence showing all four movements.
    
    Args:
        robot (RobotController): The robot controller instance.
    """
    movements = [
        ("FORWARD",  robot.move_forward),
        ("BACKWARD", robot.move_backward),
        ("LEFT",     robot.turn_left),
        ("RIGHT",    robot.turn_right),
    ]

    print("\n[DEMO] Starting movement demonstration...\n")

    for name, movement_func in movements:
        print(f">>> {name}")
        movement_func()
        time.sleep(MOVE_DURATION)
        robot.stop()
        time.sleep(PAUSE_DURATION)
        print()

    print("[DEMO] Demonstration complete.\n")


def interactive_mode(robot):
    """
    Run the robot in interactive keyboard control mode.
    
    Controls:
        W / w  → Forward
        S / s  → Backward
        A / a  → Left
        D / d  → Right
        X / x  → Stop
        + / =  → Increase speed
        - / _  → Decrease speed
        Q / q  → Quit
    """
    print("\n" + "=" * 50)
    print(" Interactive Control Mode")
    print("=" * 50)
    print(" W = Forward  |  S = Backward")
    print(" A = Left     |  D = Right")
    print(" X = Stop     |  Q = Quit")
    print(" + = Speed Up |  - = Speed Down")
    print("=" * 50 + "\n")

    try:
        while True:
            cmd = input("Command > ").strip().lower()

            if cmd == 'w':
                print(">>> FORWARD")
                robot.move_forward()
            elif cmd == 's':
                print(">>> BACKWARD")
                robot.move_backward()
            elif cmd == 'a':
                print(">>> LEFT")
                robot.turn_left()
            elif cmd == 'd':
                print(">>> RIGHT")
                robot.turn_right()
            elif cmd == 'x':
                print(">>> STOP")
                robot.stop()
            elif cmd in ['+', '=']:
                robot.set_speed(robot.current_speed + 10)
            elif cmd in ['-', '_']:
                robot.set_speed(robot.current_speed - 10)
            elif cmd == 'q':
                print("\n[EXIT] Shutting down...")
                break
            else:
                print(f"[WARN] Unknown command: '{cmd}'")

    except KeyboardInterrupt:
        print("\n\n[EXIT] Interrupted by user.")


# ──────────────────────────────────────────────
#  Main Entry Point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    robot = RobotController()

    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--demo":
            # Run automated demo sequence
            demo_sequence(robot)
        else:
            # Run interactive control mode
            interactive_mode(robot)

    except Exception as e:
        print(f"\n[ERROR] {e}")

    finally:
        # Always clean up GPIO on exit
        robot.cleanup()
