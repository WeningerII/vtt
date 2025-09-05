/**
 * Equipment Panel Component - Manage character equipment and inventory
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  Plus,
  Trash2,
  Edit3,
  Package,
  Sword,
  Shield,
  Wrench,
  Gem,
  Search,
  Weight,
  Coins,
  Star,
} from "lucide-react";
import type { Character, Equipment } from "./CharacterSheet";

interface EquipmentPanelProps {
  character: Character;
  isEditing: boolean;
  onUpdate: (_updates: Partial<Character>) => void;
}

interface EquipmentFormData {
  name: string;
  type: Equipment["type"];
  quantity: number;
  weight: number;
  value: number;
  description: string;
  properties: string[];
}

const EQUIPMENT_TYPES = [
  { key: "weapon", label: "Weapon", icon: Sword },
  { key: "armor", label: "Armor", icon: Shield },
  { key: "tool", label: "Tool", icon: Wrench },
  { key: "consumable", label: "Consumable", icon: Package },
  { key: "treasure", label: "Treasure", icon: Gem },
  { key: "other", label: "Other", icon: Package },
] as const;

export const EquipmentPanel = memo(({
  character,
  isEditing,
  onUpdate,
}: EquipmentPanelProps): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<Equipment["type"] | "all">("all");
  const [showEquippedOnly, setShowEquippedOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: "",
    type: "other",
    quantity: 1,
    weight: 0,
    value: 0,
    description: "",
    properties: [],
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "other",
      quantity: 1,
      weight: 0,
      value: 0,
      description: "",
      properties: [],
    });
    setEditingItem(null);
    setShowAddForm(false);
  };

  const addOrUpdateEquipment = () => {
    if (!formData.name.trim()) {return;}

    const newItem: Equipment = {
      id: editingItem?.id || `eq_${Date.now()}`,
      name: formData.name.trim(),
      type: formData.type,
      quantity: Math.max(1, formData.quantity),
      weight: Math.max(0, formData.weight),
      value: Math.max(0, formData.value),
      description: formData.description.trim(),
      equipped: editingItem?.equipped || false,
      properties: formData.properties.filter((p) => p.trim()),
    };

    let newEquipment;
    if (editingItem) {
      newEquipment = character.equipment.map((item) =>
        item.id === editingItem.id ? newItem : item,
      );
    } else {
      newEquipment = [...character.equipment, newItem];
    }

    onUpdate({ equipment: newEquipment });
    resetForm();
  };

  const removeEquipment = (id: string) => {
    const newEquipment = character.equipment.filter((item) => item.id !== id);
    onUpdate({ equipment: newEquipment });
  };

  const toggleEquipped = (id: string) => {
    const newEquipment = character.equipment.map((item) =>
      item.id === id ? { ...item, equipped: !item.equipped } : item,
    );
    onUpdate({ equipment: newEquipment });
  };

  const startEdit = (item: Equipment) => {
    setFormData({
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      weight: item.weight,
      value: item.value,
      description: item.description,
      properties: [...item.properties],
    });
    setEditingItem(item);
    setShowAddForm(true);
  };

  const filteredEquipment = character.equipment.filter((item) => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== "all" && item.type !== filterType) {
      return false;
    }
    if (showEquippedOnly && !item.equipped) {
      return false;
    }
    return true;
  });

  const totalWeight = character.equipment.reduce(
    (sum, item) => sum + item.weight * item.quantity,
    0,
  );
  const totalValue = character.equipment.reduce((sum, item) => sum + item.value * item.quantity, 0);
  const equippedItems = character.equipment.filter((item) => item.equipped);

  const getTypeIcon = (type: Equipment["type"]) => {
    const typeData = EQUIPMENT_TYPES.find((t) => t.key === type);
    return typeData?.icon || Package;
  };

  const addProperty = () => {
    setFormData((prev) => ({ ...prev, properties: [...prev.properties, ""] }));
  };

  const updateProperty = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      properties: prev.properties.map((prop, i) => (i === index ? value : prop)),
    }));
  };

  const removeProperty = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      properties: prev.properties.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Equipment Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Package className="h-6 w-6 text-accent-primary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{character.equipment.length}</div>
          <div className="text-xs text-secondary">Total Items</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Star className="h-6 w-6 text-warning mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{equippedItems.length}</div>
          <div className="text-xs text-secondary">Equipped</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Weight className="h-6 w-6 text-text-tertiary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{totalWeight}</div>
          <div className="text-xs text-secondary">lbs Total</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Coins className="h-6 w-6 text-warning mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{totalValue}</div>
          <div className="text-xs text-secondary">gp Value</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as Equipment["type"] | "all")}
            className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary text-sm"
          >
            <option value="all">All Types</option>
            {EQUIPMENT_TYPES.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <Button
            variant={showEquippedOnly ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowEquippedOnly(!showEquippedOnly)}
            leftIcon={<Star className="h-4 w-4" />}
          >
            Equipped
          </Button>

          {isEditing && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && isEditing && (
        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary">
              {editingItem ? "Edit Equipment" : "Add Equipment"}
            </h3>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Equipment name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, type: e.target.value as Equipment["type"] }))
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary"
              >
                {EQUIPMENT_TYPES.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Weight (lbs)
              </label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.weight}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Value (gp)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.value}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary resize-none"
              rows={3}
              placeholder="Equipment description..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-primary">Properties</label>
              <Button variant="ghost" size="sm" onClick={addProperty}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {formData.properties.map((property, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={property}
                    onChange={(e) => updateProperty(index, e.target.value)}
                    placeholder="Property name"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeProperty(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={addOrUpdateEquipment}>
              {editingItem ? "Update" : "Add"} Equipment
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Equipment List */}
      <div className="space-y-2">
        {filteredEquipment.map((item) => {
          const TypeIcon = getTypeIcon(item.type);

          return (
            <div
              key={item.id}
              className={cn(
                "bg-bg-tertiary rounded-lg border border-border-primary p-3 transition-colors",
                item.equipped && "bg-accent-light border-accent-primary",
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <TypeIcon className="h-5 w-5 text-accent-primary" />
                    {isEditing && (
                      <button
                        onClick={() => toggleEquipped(item.id)}
                        className={cn(
                          "w-4 h-4 rounded border transition-colors",
                          item.equipped
                            ? "bg-accent-primary border-accent-primary"
                            : "border-border-primary hover:border-accent-primary",
                        )}
                      >
                        {item.equipped && <Star className="h-3 w-3 text-white fill-current" />}
                      </button>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-primary">{item.name}</h4>
                      {item.equipped && (
                        <span className="text-xs bg-accent-primary text-white px-2 py-1 rounded">
                          Equipped
                        </span>
                      )}
                      <span className="text-xs bg-bg-primary text-text-tertiary px-2 py-1 rounded capitalize">
                        {item.type}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-sm text-secondary mt-1">{item.description}</p>
                    )}

                    {item.properties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.properties.map((property, index) => (
                          <span
                            key={index}
                            className="text-xs bg-accent-secondary text-accent-primary px-2 py-1 rounded"
                          >
                            {property}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-sm text-secondary">
                      <span>Qty: {item.quantity}</span>
                      <span>Weight: {item.weight} lbs</span>
                      <span>Value: {item.value} gp</span>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEquipment(item.id)}
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEquipment.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No Equipment Found</h3>
          <p className="text-secondary">
            {searchTerm
              ? `No equipment matches "${searchTerm}"`
              : showEquippedOnly
                ? "No equipped items found"
                : isEditing
                  ? "Add some equipment to get started"
                  : "This character has no equipment"}
          </p>
          {isEditing && !searchTerm && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="mt-4"
            >
              Add Equipment
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default EquipmentPanel;
