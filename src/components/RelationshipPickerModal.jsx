import React, { useState } from "react";
import "./RelationshipPickerModal.css";

const OPTIONS = [
  "Friend", "Best Friend", "Family", "Parent", "Child", "Sibling", "Relative",
  "Partner", "Spouse", "Fiance", "Dating", "Ex-Partner", "Neighbor",
  "Colleague", "Manager", "Mentor", "Mentee", "Classmate", "Teacher", "Student",
  "Business Partner", "Client", "Customer", "Professional Contact",
  "Teammate", "Club Member", "Community Member", "Roommate", "Healthcare Provider",
  "Caregiver", "Emergency Contact", "Other",
];

export default function RelationshipPickerModal({ open, onClose, onSubmit, loading = false }) {
  const [selected, setSelected] = useState([]);
  const [other, setOther] = useState("");
  if (!open) return null;
  const toggle = (value) => setSelected((current) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
  );
  const submit = (event) => {
    event.preventDefault();
    const values = selected.filter((item) => item !== "Other");
    if (selected.includes("Other") && other.trim()) values.push(other.trim());
    if (values.length) onSubmit([...new Set(values)]);
  };
  return (
    <div className="relationship-modal-backdrop" role="dialog" aria-modal="true">
      <form className="relationship-modal" onSubmit={submit}>
        <h3>Select relationship</h3>
        <p>Choose one or more relationships for this connection.</p>
        <div className="relationship-options">
          {OPTIONS.map((option) => (
            <label key={option}>
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
        </div>
        {selected.includes("Other") && (
          <input autoFocus value={other} onChange={(event) => setOther(event.target.value)}
            placeholder="Type relationship" maxLength={80} required />
        )}
        <div className="relationship-modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={loading || !selected.length || (selected.includes("Other") && !other.trim())}>
            {loading ? "Saving..." : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
