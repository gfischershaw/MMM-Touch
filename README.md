# MMM-Touch
MagicMirror plugin for touch gesture commander using touchscreen  

## Screenshot
![](https://raw.githubusercontent.com/gfischershaw/MMM-Touch/master/MMM-Touch.png)

## Features
- Multi-touch if supported by the touchpanel or touchframe
- Available gestures : `TAP`, `DOUBLE_TAP`, `PRESS`, `SWIPE_UP/DOWN/LEFT/RIGHT`, `MOVE_UP/DOWN/LEFT/RIGHT`, `ROTATE_CW/CCW`, `PINCH_IN/OUT`
  - Example: `TAP_1`(tapping with 1 finger), `SWIPE_LEFT_2`(swiping left with 2 fingers), `PINCH_IN_3`(pinching-in with 3 fingers)
  - For `ROTATE_CW` and `ROTATE_CCW` only 2 fingers are recognized.
- Available commands:
  - Emitting custom notifications
  - Executing shell script/commands directly
  - Executing methods of module(s)
  - Usual JavaScript codes
- Different gestures and commands with `mode` by condition
- Dynamic configuration : Other module easily add gestureCommand for itself by notification

## Install & Configuration
Read the [wiki](../../wiki) for the detail configuration.

## Documents
Read the [wiki](../../wiki)
