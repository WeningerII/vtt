/**
 * FeaturesPanel Component - Display and manage character features, traits, and abilities
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Separator } from '../ui/separator';
import { Character } from '@vtt/core-schemas';

interface FeaturesPanelProps {
  character: Character;
  onCharacterUpdate: (updates: Partial<Character>) => void;
  readOnly?: boolean;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  source: string;
  level?: number;
  uses?: {
    current: number;
    max: number;
    resetOn: 'short' | 'long' | 'daily';
  };
}

export const FeaturesPanel: React.FC<FeaturesPanelProps> = ({
  character,
  onCharacterUpdate,
  readOnly = false
}) => {
  // Mock features data - in a real implementation, this would come from character.features
  const features: Feature[] = [
    {
      id: 'racial-darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet of you as if it were bright light.',
      source: 'Racial',
      level: 1
    },
    {
      id: 'class-rage',
      name: 'Rage',
      description: 'On your turn, you can enter a rage as a bonus action.',
      source: 'Barbarian',
      level: 1,
      uses: {
        current: 2,
        max: 2,
        resetOn: 'long'
      }
    },
    {
      id: 'class-unarmored-defense',
      name: 'Unarmored Defense',
      description: 'While not wearing armor, your AC equals 10 + Dex modifier + Con modifier.',
      source: 'Barbarian',
      level: 1
    }
  ];

  const groupedFeatures = features.reduce((acc, feature) => {
    const source = feature.source;
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'racial': return 'bg-blue-500/20 text-blue-300';
      case 'class': return 'bg-green-500/20 text-green-300';
      case 'barbarian': return 'bg-red-500/20 text-red-300';
      case 'background': return 'bg-purple-500/20 text-purple-300';
      case 'feat': return 'bg-yellow-500/20 text-yellow-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Features & Traits</h2>
        <Badge variant="outline" className="text-gray-300">
          {features.length} Features
        </Badge>
      </div>

      {Object.entries(groupedFeatures).map(([source, sourceFeatures]) => (
        <Card key={source} className="bg-white/5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge className={getSourceColor(source)}>
                {source}
              </Badge>
              <span className="text-gray-300">
                ({sourceFeatures.length} feature{sourceFeatures.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceFeatures.map((feature, index) => (
              <div key={feature.id}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      {feature.name}
                      {feature.level && (
                        <Badge variant="outline" className="text-xs">
                          Level {feature.level}
                        </Badge>
                      )}
                    </h4>
                    <p className="text-gray-300 text-sm mt-1 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                  
                  {feature.uses && (
                    <div className="ml-4 text-right">
                      <div className="text-sm text-gray-400">Uses</div>
                      <div className="text-lg font-bold text-white">
                        {feature.uses.current}/{feature.uses.max}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        Per {feature.uses.resetOn} rest
                      </div>
                    </div>
                  )}
                </div>
                
                {index < sourceFeatures.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {features.length === 0 && (
        <Card className="bg-white/5">
          <CardContent className="text-center py-8">
            <div className="text-gray-400 text-lg mb-2">No Features Yet</div>
            <p className="text-gray-500 text-sm">
              Features and traits will appear here as your character gains levels and abilities.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
