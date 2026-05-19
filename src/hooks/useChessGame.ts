import { useState, useCallback, useMemo } from 'react';
import { Chess, Move } from 'chess.js';

export const useChessGame = () => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null);

  const updateGameState = useCallback((currentGame: Chess) => {
    setFen(currentGame.fen());
    setHistory(currentGame.history());
    
    if (currentGame.isGameOver()) {
      if (currentGame.isCheckmate()) {
        setWinner(currentGame.turn() === 'w' ? 'black' : 'white');
      } else {
        setWinner('draw');
      }
    } else {
      setWinner(null);
    }
  }, []);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    let madeMove = false;
    setGame(prevGame => {
      const nextGame = new Chess(prevGame.fen());
      try {
        const moveResult = nextGame.move(move);
        if (moveResult) {
          madeMove = true;
          updateGameState(nextGame);
          return nextGame;
        }
      } catch (e) {
        // illegal move
      }
      return prevGame;
    });
    return madeMove;
  }, [updateGameState]);

  const resetGame = useCallback(() => {
    const nextGame = new Chess();
    setGame(nextGame);
    updateGameState(nextGame);
  }, [updateGameState]);

  const undoMove = useCallback(() => {
    setGame(prevGame => {
      const nextGame = new Chess(prevGame.fen());
      if (nextGame.undo()) {
        updateGameState(nextGame);
        return nextGame;
      }
      return prevGame;
    });
  }, [updateGameState]);

  const isCheck = useMemo(() => game.inCheck(), [fen]);

  return {
    fen,
    history,
    winner,
    isCheck,
    turn: game.turn(),
    makeMove,
    resetGame,
    undoMove,
  };
};
