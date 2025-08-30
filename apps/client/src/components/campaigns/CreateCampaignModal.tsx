/**
 * Create Campaign Modal - Form for creating new campaigns with system selection
 */
import React, { useState } from 'react';
import { X, Upload, _Users, Globe, Lock, UserCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn, generateId } from '../../lib/utils';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (campaign: any) => void;
}

interface CampaignFormData {
  name: string;
  system: string;
  description: string;
  maxPlayers: number;
  visibility: 'public' | 'private' | 'friends';
  autoAccept: boolean;
  coverImage?: File;
}

const gameSystems = [
  { id: 'dnd5e', name: 'Dungeons & Dragons 5th Edition', popular: true },
  { id: 'pathfinder2e', name: 'Pathfinder 2nd Edition', popular: true },
  { id: 'cyberpunk-red', name: 'Cyberpunk Red', popular: false },
  { id: 'call-of-cthulhu', name: 'Call of Cthulhu 7th Edition', popular: true },
  { id: 'vampire-masquerade', name: 'Vampire: The Masquerade 5th Edition', popular: false },
  { id: 'savage-worlds', name: 'Savage Worlds Adventure Edition', popular: false },
  { id: 'fate-core', name: 'Fate Core System', popular: false },
  { id: 'pbta', name: 'Powered by the Apocalypse', popular: false },
  { id: 'custom', name: 'Custom System', popular: false },
];

export function CreateCampaignModal({ isOpen, _onClose, _onSuccess }: CreateCampaignModalProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    system: '',
    description: '',
    maxPlayers: 6,
    visibility: 'private',
    autoAccept: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleChange = (_field: keyof CampaignFormData, _value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, coverImage: 'Image must be less than 5MB' }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, coverImage: 'Please select a valid image file' }));
        return;
      }
      handleChange('coverImage', file);
      setErrors(prev => ({ ...prev, coverImage: '' }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    }
    
    if (!formData.system) {
      newErrors.system = 'Please select a game system';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Campaign description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description should be at least 20 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newCampaign = {
        id: generateId('campaign'),
        ...formData,
        status: 'planning' as const,
        players: 0,
        sessions: 0,
        totalHours: 0,
        createdAt: new Date(),
      };
      
      onSuccess(newCampaign);
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        system: '',
        description: '',
        maxPlayers: 6,
        visibility: 'private',
        autoAccept: false,
      });
      setStep(1);
    } catch (_error) {
      setErrors({ general: 'Failed to create campaign. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Create New Campaign</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                step >= 1 ? "bg-primary-600 text-white" : "bg-neutral-200 text-neutral-600"
              )}>
                1
              </div>
              <div className={cn(
                "w-16 h-px",
                step > 1 ? "bg-primary-600" : "bg-neutral-200"
              )} />
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                step >= 2 ? "bg-primary-600 text-white" : "bg-neutral-200 text-neutral-600"
              )}>
                2
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} role="form">
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-neutral-900">Campaign Details</h3>
                
                {/* Campaign Name */}
                <Input
                  label="Campaign Name"
                  placeholder="Enter a memorable campaign name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={errors.name}
                  disabled={loading}
                />

                {/* Game System */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Game System
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-neutral-200 rounded-lg p-2">
                    {gameSystems.map((_system) => (
                      <label
                        key={system.id}
                        className={cn(
                          "flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors",
                          formData.system === system.id
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 hover:border-neutral-300",
                          system.popular && "ring-1 ring-warning-200"
                        )}
                      >
                        <input
                          type="radio"
                          name="system"
                          value={system.id}
                          checked={formData.system === system.id}
                          onChange={(e) => handleChange('system', e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-900 truncate">
                              {system.name}
                            </span>
                            {system.popular && (
                              <span className="ml-2 px-2 py-1 text-xs bg-warning-100 text-warning-800 rounded-full">
                                Popular
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.system && (
                    <p className="text-xs text-error-600">{errors.system}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Campaign Description
                  </label>
                  <textarea
                    placeholder="Describe your campaign setting, tone, and what players can expect..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={4}
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                      errors.description ? "border-error-300" : "border-neutral-300"
                    )}
                    disabled={loading}
                  />
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>{formData.description.length}/500 characters</span>
                    {errors.description && (
                      <span className="text-error-600">{errors.description}</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={handleNext} disabled={loading}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-neutral-900">Campaign Settings</h3>

                {/* Max Players */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Maximum Players
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={formData.maxPlayers}
                      onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-16 text-center">
                      <span className="text-lg font-medium text-primary-600">
                        {formData.maxPlayers}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    You can always adjust this later
                  </p>
                </div>

                {/* Visibility */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-neutral-700">
                    Campaign Visibility
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'private', icon: Lock, label: 'Private', desc: 'Only you can see and manage this campaign' },
                      { value: 'friends', icon: UserCheck, label: 'Friends Only', desc: 'Only your friends can find and join' },
                      { value: 'public', icon: Globe, label: 'Public', desc: 'Anyone can find and request to join' },
                    ].map((_option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors",
                          formData.visibility === option.value
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 hover:border-neutral-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={option.value}
                          checked={formData.visibility === option.value}
                          onChange={(e) => handleChange('visibility', e.target.value)}
                          className="sr-only"
                        />
                        <option.icon className="h-5 w-5 text-neutral-600 mr-3" />
                        <div>
                          <div className="font-medium text-neutral-900">{option.label}</div>
                          <div className="text-sm text-neutral-600">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Auto Accept */}
                {formData.visibility !== 'private' && (
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-neutral-900">Auto-accept join requests</h4>
                      <p className="text-sm text-neutral-600">
                        Players can join immediately without your approval
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autoAccept}
                        onChange={(e) => handleChange('autoAccept', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                )}

                {/* Cover Image Upload */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Cover Image (Optional)
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-300 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-neutral-400" />
                        <p className="mb-2 text-sm text-neutral-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-neutral-500">PNG, JPG or GIF (MAX. 5MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      / aria-label="enter a memorable campaign name input">
                    </label>
                  </div>
                  {errors.coverImage && (
                    <p className="text-xs text-error-600">{errors.coverImage}</p>
                  )}
                  {formData.coverImage && (
                    <p className="text-sm text-success-600">
                      ✓ {formData.coverImage.name} uploaded
                    </p>
                  )}
                </div>

                {errors.general && (
                  <div className="p-3 text-sm text-error-700 bg-error-50 border border-error-200 rounded-lg">
                    {errors.general}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="submit" loading={loading}>
                    Create Campaign
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
