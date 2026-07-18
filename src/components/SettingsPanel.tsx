import React, { useState, useEffect } from 'react';
import { BoxConfig } from '../types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ChevronDown } from 'lucide-react';

interface SettingsPanelProps {
  config: BoxConfig;
  onChange: (updates: Partial<BoxConfig>) => void;
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button className="w-full flex items-center justify-between px-4 py-3.5 text-left" onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{title}</span>
        <ChevronDown size={15} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-5 space-y-5">{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, unit = 'mm', decimals = 0, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; decimals?: number; onChange: (v: number) => void;
}) {
  const fmt = (v: number) => v.toFixed(decimals);
  const [displayVal, setDisplayVal] = useState(value);
  const [inputVal, setInputVal] = useState(fmt(value));

  useEffect(() => { setDisplayVal(value); setInputVal(fmt(value)); }, [value]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      onChange(clamped);
      setDisplayVal(clamped);
      setInputVal(fmt(clamped));
    } else {
      setDisplayVal(value);
      setInputVal(fmt(value));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <Label className="text-sm text-foreground shrink-0">{label}</Label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={inputVal}
            min={min} max={max} step={step}
            onChange={e => setInputVal(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-16 text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded text-right border border-transparent focus:border-primary/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-xs text-muted-foreground shrink-0">{unit}</span>}
        </div>
      </div>
      <Slider
        value={[displayVal]}
        min={min} max={max} step={step}
        onValueChange={([v]) => { setDisplayVal(v); setInputVal(fmt(v)); }}
        onValueCommit={([v]) => onChange(v)}
        className="py-1"
      />
    </div>
  );
}

function ToggleRow({ label, checked, onCheckedChange, hint }: {
  label: string; checked: boolean; onCheckedChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm text-foreground">{label}</Label>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function SettingsPanel({ config, onChange }: SettingsPanelProps) {
  return (
    <div className="bg-background">
      <Section title="Box Dimensions">
        <SliderRow label="Width"  value={config.width}  min={50} max={500} onChange={v => onChange({ width: v })} />
        <SliderRow label="Height" value={config.height} min={50} max={500} onChange={v => onChange({ height: v })} />
        <SliderRow label="Depth"  value={config.depth}  min={20} max={200} onChange={v => onChange({ depth: v })} />
      </Section>

      <Section title="Control Box (Electronics)">
        <SliderRow
          label="Device Clearance (from wall)"
          value={config.deviceClearance}
          min={0} max={Math.max(0, config.depth - 5)}
          onChange={v => onChange({ deviceClearance: v })}
        />
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed -mt-2">
          Height of your LED controller/driver box measured from the wall side.
          The panel stays fully solid for this depth — cut lines only start after this gap.
        </p>
        {config.deviceClearance > 0 && config.deviceClearance >= config.depth * 0.75 && (
          <div className="text-[10px] rounded-lg px-3 py-2" style={{ background: '#3a1a1a', border: '1px solid #7a2f2f', color: '#ff9a9a' }}>
            Warning: clearance is {Math.round((config.deviceClearance / config.depth) * 100)}% of box depth — very little cutting area left.
          </div>
        )}
      </Section>

      <Section title="LED Position">
        <SliderRow label="Z — Distance from wall" value={config.ledZ} min={1} max={config.depth} onChange={v => onChange({ ledZ: v })} />
        <SliderRow label="X Offset" value={config.ledX} min={-config.width / 2} max={config.width / 2} onChange={v => onChange({ ledX: v })} />
        <SliderRow label="Y Offset" value={config.ledY} min={-config.height / 2} max={config.height / 2} onChange={v => onChange({ ledY: v })} />
      </Section>

      <Section title="Box Position">
        <SliderRow label="Shadow Scale" value={config.shadowScale} min={1.5} max={10} step={0.1} decimals={1} unit="×" onChange={v => onChange({ shadowScale: v })} />
        <SliderRow label="X Offset (left / right)" value={config.silhouetteOffsetX} min={-200} max={200} onChange={v => onChange({ silhouetteOffsetX: v })} />
        <SliderRow label="Y Offset (up / down)" value={config.silhouetteOffsetY} min={-200} max={200} onChange={v => onChange({ silhouetteOffsetY: v })} />
        <SliderRow label="Box Rotation" value={config.silhouetteRotation} min={-180} max={180} unit="°" onChange={v => onChange({ silhouetteRotation: v })} />
        <SliderRow label="Shadow Rotation" value={config.shadowRotation} min={-180} max={180} unit="°" onChange={v => onChange({ shadowRotation: v })} />
      </Section>

      <Section title="Material">
        <SliderRow label="Thickness" value={config.materialThickness} min={2.0} max={6.0} step={0.1} decimals={1} onChange={v => onChange({ materialThickness: v })} />
        <SliderRow label="Tab Width" value={config.tabWidth} min={5} max={25} onChange={v => onChange({ tabWidth: v })} />
        <ToggleRow
          label="Invert Cutout"
          checked={config.invertCutout}
          onCheckedChange={v => onChange({ invertCutout: v })}
          hint="Off — panels keep the full declared depth. On — each panel is trimmed to the deepest cut point + 1 mm (all 4 panels trimmed equally so the box closes evenly). Removes the empty rectangular frame at the front."
        />
      </Section>
    </div>
  );
}
