package ru.taxios.app

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.taxios.app.tracking.StatusAutomation
import ru.taxios.app.tracking.StatusAutomation.Action
import ru.taxios.app.tracking.StatusAutomation.State
import ru.taxios.app.tracking.StatusAutomation.Status

class StatusAutomationTest {
    private val idle = State(shiftActive = true, inOrder = false, paused = false, lastStatus = Status.ONLINE)

    @Test
    fun `recognizes statuses`() {
        assertEquals(Status.NEW_ORDER, StatusAutomation.statusOf("Новый заказ"))
        assertEquals(Status.ON_ORDER, StatusAutomation.statusOf(" На заказе "))
        assertEquals(Status.ONLINE, StatusAutomation.statusOf("На линии"))
        assertEquals(Status.BUSY, StatusAutomation.statusOf("Занят"))
        assertEquals(null, StatusAutomation.statusOf("Яндекс Про"))
    }

    @Test
    fun `typical order flow`() {
        assertEquals(emptyList<Action>(), StatusAutomation.decide(idle, Status.NEW_ORDER))
        assertEquals(listOf(Action.START_ORDER), StatusAutomation.decide(idle.copy(lastStatus = Status.NEW_ORDER), Status.ON_ORDER))
        val onOrder = idle.copy(inOrder = true, lastStatus = Status.ON_ORDER)
        assertEquals(listOf(Action.FINISH_ORDER), StatusAutomation.decide(onOrder, Status.ONLINE))
    }

    @Test
    fun `chained order finishes current and starts next`() {
        val onOrder = idle.copy(inOrder = true, lastStatus = Status.NEW_ORDER)
        assertEquals(listOf(Action.FINISH_ORDER, Action.START_ORDER), StatusAutomation.decide(onOrder, Status.ON_ORDER))
        // Повтор «На заказе» без нового предложения — ничего не делаем.
        assertEquals(emptyList<Action>(), StatusAutomation.decide(onOrder.copy(lastStatus = Status.ON_ORDER), Status.ON_ORDER))
    }

    @Test
    fun `busy pauses and online resumes`() {
        assertEquals(listOf(Action.PAUSE), StatusAutomation.decide(idle, Status.BUSY))
        val paused = idle.copy(paused = true, lastStatus = Status.BUSY)
        assertEquals(emptyList<Action>(), StatusAutomation.decide(paused, Status.BUSY))
        assertEquals(listOf(Action.RESUME), StatusAutomation.decide(paused, Status.ONLINE))
        assertEquals(listOf(Action.RESUME, Action.START_ORDER), StatusAutomation.decide(paused, Status.ON_ORDER))
    }

    @Test
    fun `going online starts shift automatically`() {
        val none = State(shiftActive = false, inOrder = false, paused = false, lastStatus = null)
        assertEquals(listOf(Action.START_SHIFT), StatusAutomation.decide(none, Status.ONLINE))
        assertEquals(listOf(Action.START_SHIFT, Action.START_ORDER), StatusAutomation.decide(none, Status.ON_ORDER))
        assertEquals(emptyList<Action>(), StatusAutomation.decide(none, Status.BUSY))
    }
}
