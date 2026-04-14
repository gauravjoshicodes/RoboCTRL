import sys

# Ensure stdout can handle any characters on Windows (Python 3.7+)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

"""
============================================================
 gpio_mock.py  -  RPi.GPIO stub for non-Raspberry-Pi platforms
============================================================

 When RPi.GPIO is not available (e.g. Windows / macOS / CI),
 this module is used as a drop-in replacement.  All calls are
 logged to the console so you can verify logic without hardware.

 Usage (handled automatically by robot_motion_control.py and
 obstacle_avoidance.py – no manual changes needed):

     try:
         import RPi.GPIO as GPIO
     except (ImportError, RuntimeError):
         from gpio_mock import MockGPIO as GPIO

============================================================
"""

# ── Pin mode constants ──────────────────────────────────────
BCM  = "BCM"
BOARD = "BOARD"
OUT  = "OUT"
IN   = "IN"
HIGH = True
LOW  = False


# ── Internal state ──────────────────────────────────────────
_pin_states: dict = {}          # pin -> True/False
_pin_modes:  dict = {}          # pin -> "OUT" | "IN"
_gpio_mode: str | None = None
_warnings_enabled: bool = True


def _log(msg: str) -> None:
    """Print a labelled mock message."""
    print(f"  [GPIO-MOCK] {msg}")


# ── Public GPIO API ─────────────────────────────────────────

def setmode(mode: str) -> None:
    global _gpio_mode
    _gpio_mode = mode
    _log(f"setmode({mode})")


def setwarnings(flag: bool) -> None:
    global _warnings_enabled
    _warnings_enabled = flag


def setup(pin, direction, initial=LOW) -> None:
    _pin_modes[pin]  = direction
    _pin_states[pin] = initial
    _log(f"setup(pin={pin}, dir={direction})")


def output(pin, value) -> None:
    _pin_states[pin] = value
    state_str = "HIGH" if value else "LOW"
    _log(f"output(pin={pin}) -> {state_str}")


def input(pin) -> bool:
    """Return last set state for the pin (always LOW for sensor pins in mock)."""
    return _pin_states.get(pin, LOW)


def cleanup() -> None:
    _pin_states.clear()
    _pin_modes.clear()
    _log("cleanup() - all pins released")


# ── PWM class ───────────────────────────────────────────────

class PWM:
    """Mock PWM channel."""

    def __init__(self, pin: int, frequency: float):
        self.pin = pin
        self.frequency = frequency
        self.duty_cycle = 0.0
        _log(f"PWM(pin={pin}, freq={frequency} Hz) created")

    def start(self, duty_cycle: float) -> None:
        self.duty_cycle = duty_cycle
        _log(f"PWM pin={self.pin} start(dc={duty_cycle}%)")

    def stop(self) -> None:
        self.duty_cycle = 0.0
        _log(f"PWM pin={self.pin} stop()")

    def ChangeDutyCycle(self, duty_cycle: float) -> None:
        self.duty_cycle = duty_cycle
        _log(f"PWM pin={self.pin} ChangeDutyCycle({duty_cycle}%)")

    def ChangeFrequency(self, frequency: float) -> None:
        self.frequency = frequency
        _log(f"PWM pin={self.pin} ChangeFrequency({frequency} Hz)")
