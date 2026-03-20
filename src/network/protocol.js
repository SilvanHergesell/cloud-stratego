export const MESSAGE_TYPES = {
    HELLO: 'hello',
    SETUP_CONFIRMED: 'setupConfirmed',
    SETUP_POSITIONS: 'setupPositions',
    TURN_MOVE: 'turnMove',
    COMBAT_RESULT: 'combatResult',
    GAME_OVER: 'gameOver',
    REVEAL_REQUEST: 'revealRequest',
    REMATCH_REQUEST: 'rematchRequest',
    REMATCH_START: 'rematchStart',
    REMATCH_MODE_SELECT_OPEN: 'rematchModeSelectOpen',
    MODE_SELECTED: 'modeSelected',
    CUSTOM_NAMES_SUBMITTED: 'customNamesSubmitted',
    ERROR: 'error',
};

export function createMessage(type, payload = {}) {
    return {
        type,
        payload,
        timestamp: Date.now(),
    };
}

export function isValidMessageShape(message) {
    return Boolean(
        message &&
        typeof message === 'object' &&
        typeof message.type === 'string' &&
        Object.values(MESSAGE_TYPES).includes(message.type),
    );
}
