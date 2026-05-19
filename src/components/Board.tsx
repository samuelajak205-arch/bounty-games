import React from 'react';
import { Chessboard } from 'react-chessboard';

interface BoardProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  orientation?: 'white' | 'black';
  disabled?: boolean;
  customSquareStyles?: Record<string, React.CSSProperties>;
}

const ChessboardAny = Chessboard as any;

export const Board: React.FC<BoardProps> = ({ 
  position,
  onPieceDrop,
  orientation = 'white',
  disabled = false,
  customSquareStyles
}) => {
  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    console.log('Board: Piece dropped from', sourceSquare, 'to', targetSquare, 'piece', piece);
    if (disabled) {
        console.log('Board: Dragging disabled');
        return false;
    }
    // Optimistically initiate the move; server authoritative update will confirm or revert
    return onPieceDrop(sourceSquare, targetSquare, piece);
  };

  return (
    <div className="w-full max-w-[500px] aspect-square rounded overflow-hidden shadow-lg border border-gray-200">
      <ChessboardAny
        key={position}
        position={position}
        onPieceDrop={onDrop}
        boardOrientation={orientation}
        animationDuration={200}
      />
    </div>
  );
};
