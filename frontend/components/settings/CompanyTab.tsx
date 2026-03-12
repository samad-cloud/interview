'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CompanyTab() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#6366F1');
  const [companyName, setCompanyName] = useState('');
  const [about, setAbout] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [hq, setHq] = useState('');
  const [companySize, setCompanySize] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    logoPreviewRef.current = logoPreview;
  }, [logoPreview]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current);
      }
    };
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left column: logo upload + brand colour */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Logo upload card */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium text-foreground">Company Logo</Label>
          <div
            className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500/60 transition-colors min-h-[10rem]"
            onClick={() => fileInputRef.current?.click()}
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Company logo preview"
                className="w-full h-40 object-contain rounded-lg"
              />
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Upload company logo</span>
                <span className="text-xs text-muted-foreground">PNG or SVG, max 2MB</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        {/* Brand colour picker */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium text-foreground">Brand Colour</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent p-0.5"
            />
            <div
              className="w-10 h-10 rounded border border-border"
              style={{ backgroundColor: brandColor }}
            />
            <span className="text-sm text-muted-foreground font-mono">{brandColor}</span>
          </div>
        </div>
      </div>

      {/* Right column: profile fields */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        {/* Company Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Company Name</label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </div>

        {/* About */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">About</label>
          <textarea
            rows={4}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Brief description of your company..."
            className="border border-border rounded-md bg-transparent px-3 py-2 text-sm w-full resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Industry */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Industry</label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Technology">Technology</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Healthcare">Healthcare</SelectItem>
              <SelectItem value="Retail">Retail</SelectItem>
              <SelectItem value="Education">Education</SelectItem>
              <SelectItem value="Media">Media</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Website */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Website</label>
          <Input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        {/* HQ Location */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">HQ Location</label>
          <Input
            value={hq}
            onChange={(e) => setHq(e.target.value)}
            placeholder="e.g. London, UK"
          />
        </div>

        {/* Company Size */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Company Size</label>
          <Select value={companySize} onValueChange={setCompanySize}>
            <SelectTrigger>
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1-10">1–10</SelectItem>
              <SelectItem value="11-50">11–50</SelectItem>
              <SelectItem value="51-200">51–200</SelectItem>
              <SelectItem value="201-500">201–500</SelectItem>
              <SelectItem value="500+">500+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            onClick={() => {}}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
