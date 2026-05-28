Status: needs-triage

## Bug: Pressing ALT opens menu bar that is not needed

Pressing the ALT key opens the default Electron/Chromium menu bar. Vajra does not use a traditional menu bar — `autoHideMenuBar` is set but the menu still appears on ALT press. The menu bar should be fully suppressed since there are no app-level menu actions.
