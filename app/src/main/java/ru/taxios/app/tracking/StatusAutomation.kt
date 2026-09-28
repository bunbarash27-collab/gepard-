package ru.taxios.app.tracking

/**
 * Автоматика по статусам из уведомления Яндекс Про.
 * Наблюдаемые тексты: «Новый заказ» (предложение), «На заказе», «На линии», «Занят».
 */
object StatusAutomation {
    enum class Status { NEW_ORDER, ON_ORDER, ONLINE, BUSY }

    enum class Action { START_SHIFT, START_ORDER, FINISH_ORDER, PAUSE, RESUME }

    fun statusOf(text: String): Status? = when (text.trim().lowercase()) {
        "новый заказ" -> Status.NEW_ORDER
        "на заказе" -> Status.ON_ORDER
        "на линии" -> Status.ONLINE
        "занят" -> Status.BUSY
        else -> null
    }

    data class State(
        val shiftActive: Boolean,
        val inOrder: Boolean,
        val paused: Boolean,
        val lastStatus: Status?,
    )

    fun decide(state: State, status: Status): List<Action> {
        val out = mutableListOf<Action>()
        if (!state.shiftActive) {
            if (status == Status.ONLINE || status == Status.ON_ORDER) out += Action.START_SHIFT else return out
        }
        when (status) {
            Status.NEW_ORDER -> Unit
            Status.ON_ORDER -> {
                if (state.paused) out += Action.RESUME
                // Новый заказ, предложенный во время поездки (цепочка): закрываем текущий и открываем следующий.
                if (state.inOrder && state.lastStatus == Status.NEW_ORDER) out += Action.FINISH_ORDER
                if (!state.inOrder || state.lastStatus == Status.NEW_ORDER) out += Action.START_ORDER
            }
            Status.ONLINE -> {
                if (state.inOrder) out += Action.FINISH_ORDER
                if (state.paused) out += Action.RESUME
            }
            Status.BUSY -> {
                if (state.inOrder) out += Action.FINISH_ORDER
                if (!state.paused) out += Action.PAUSE
            }
        }
        return out
    }
}
