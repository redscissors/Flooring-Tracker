import { useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const saveOkTimer = useRef(null);
  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const flashSaved = () => { if (saveOkTimer.current) clearTimeout(saveOkTimer.current); setSaveOk(true); saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000); };
  return { toast, saveOk, ping, flashSaved };
}
