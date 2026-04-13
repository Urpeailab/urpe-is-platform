import React from 'react';
import { CheckSquare, Trash2, Download, Send, Archive, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';

export const BulkActions = ({ selectedCount, onAction, actions }) => {
  if (selectedCount === 0) return null;

  const defaultActions = [
    {
      key: 'export',
      label: 'Exportar seleccionados',
      icon: Download,
      variant: 'default'
    },
    {
      key: 'archive',
      label: 'Archivar',
      icon: Archive,
      variant: 'default'
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      variant: 'destructive'
    }
  ];

  const availableActions = actions || defaultActions;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl px-6 py-4 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <CheckSquare className="h-5 w-5 text-yellow-500" />
          <span className="text-white font-semibold">
            {selectedCount} {selectedCount === 1 ? 'elemento' : 'elementos'} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="h-6 w-px bg-gray-700"></div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              Acciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800">
            {availableActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <React.Fragment key={action.key}>
                  <DropdownMenuItem
                    onClick={() => onAction(action.key)}
                    className={`cursor-pointer ${
                      action.variant === 'destructive'
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </DropdownMenuItem>
                  {index < availableActions.length - 1 && action.variant === 'destructive' && (
                    <DropdownMenuSeparator className="bg-gray-800" />
                  )}
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          onClick={() => onAction('clear')}
          className="text-gray-400 hover:text-white"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};
