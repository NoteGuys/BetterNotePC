import React from 'react';

// Keep the native color dialog, with a full-size rainbow hit target.
export const ColorWheelPicker = ({ value, onChange, label }) => (
  <label className="bn-color-wheel" title={label}>
    <input
      type="color"
      value={value}
      aria-label={label}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      onChange={event => { event.stopPropagation(); onChange(event.target.value); }}
    />
  </label>
);
