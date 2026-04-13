import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import { Badge } from '../../components/ui/badge';

export const AdvancedFilters = ({ filters, activeFilters, onFilterChange, onClearFilters }) => {
  const activeFilterCount = Object.keys(activeFilters).filter(key => activeFilters[key]).length;

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-black px-1.5 py-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-gray-900 border-gray-800">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-white mb-2">Filtrar por:</p>
          </div>
          
          {filters.map((filter, index) => (
            <React.Fragment key={filter.key}>
              <div className="px-3 py-2">
                <p className="text-xs text-gray-400 mb-2">{filter.label}</p>
                <div className="space-y-1">
                  {filter.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onFilterChange(filter.key, option.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeFilters[filter.key] === option.value
                          ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {index < filters.length - 1 && <DropdownMenuSeparator className="bg-gray-800" />}
            </React.Fragment>
          ))}

          {activeFilterCount > 0 && (
            <>
              <DropdownMenuSeparator className="bg-gray-800" />
              <div className="px-3 py-2">
                <Button
                  onClick={onClearFilters}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
