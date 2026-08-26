; FloorTrack → ERP One (K8) special-order entry macro          issue 112
;
; FloorTrack's order-entry panel copies a whole special-order line with REAL
; tab characters between the fields (SKU ⇥ description ⇥ qty ⇥ cost ⇥ sell).
; The ERP pastes everything into one field, so this script replays the
; clipboard as keystrokes instead: each tab character becomes a real Tab
; keypress, each new line an Enter.
;
; Use: copy a line in FloorTrack (the clipboard-list button), click into the
; ERP's FIRST field of an empty entry line, press Ctrl+Shift+V.
;
; Requires AutoHotkey v2 (free, autohotkey.com). See README.md for setup.

#Requires AutoHotkey v2.0
#SingleInstance Force

; Tune these (milliseconds) if the ERP drops or scrambles characters —
; bigger numbers type slower but land more reliably.
KEY_DELAY := 10      ; between single keystrokes
FIELD_PAUSE := 80    ; after each Tab, before typing the next field
LINE_PAUSE := 250    ; after each Enter, before the next line

^+v:: {
    text := A_Clipboard
    if (text = "")
        return
    SetKeyDelay KEY_DELAY, 0
    for li, line in StrSplit(text, "`n", "`r") {
        if (li > 1) {
            Send "{Enter}"
            Sleep LINE_PAUSE
        }
        for fi, field in StrSplit(line, "`t") {
            if (fi > 1) {
                Send "{Tab}"
                Sleep FIELD_PAUSE
            }
            if (field != "")
                SendText field
        }
    }
}
